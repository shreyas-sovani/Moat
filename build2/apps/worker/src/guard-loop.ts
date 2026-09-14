import type { PrismaClient } from "@moat/db";
import { type PositionRisk, breachDetected, computePositionRisk } from "@moat/risk";
import type { PositionSyncHit } from "./sync-positions.js";

export const SUPERVISOR_TIMEOUT_MS = 15 * 60 * 1000;
const BACKOFF_START_MS = 2000;
const BACKOFF_CAP_MS = 30_000;

export interface GuardKh {
	executeWorkflow(workflowId: string, runId: string): Promise<unknown>;
	getExecutionStatus(executionId: string): Promise<unknown>;
	getExecution(executionId: string): Promise<unknown>;
	getExecutionLogs(executionId: string): Promise<unknown>;
}

export interface GuardAlert {
	runId: string;
	level: string;
	payload: string;
}

export interface GuardClock {
	now: () => number;
	sleep: (ms: number) => Promise<void>;
}

export interface AssessResult {
	risk: PositionRisk;
	breach: boolean;
}

export interface GuardLoopContext {
	prisma: PrismaClient;
	sync: () => Promise<PositionSyncHit[]>;
	kh: GuardKh;
	assess: (hit: PositionSyncHit, policy: { triggerRatioPct: number }) => AssessResult;
	clock: GuardClock;
	notify?: (alert: GuardAlert) => Promise<void>;
	supervisorTimeoutMs?: number;
}

type ArmedPolicy = {
	id: string;
	triggerRatioPct: number;
	position: { marketId: string; walletAddress: string };
	guards: Array<{ id: string; khWorkflowId: string }>;
};

export function defaultAssess(
	hit: PositionSyncHit,
	policy: { triggerRatioPct: number },
	market: { lltv: string; loanToken: string; collateralToken: string; oracle: string },
): AssessResult {
	const risk = computePositionRisk(hit.raw, {
		lltv: BigInt(market.lltv),
		loanToken: market.loanToken,
		collateralToken: market.collateralToken,
		oracle: market.oracle,
	});
	return { risk, breach: breachDetected(risk, policy) };
}

export async function tickWatcher(ctx: GuardLoopContext): Promise<void> {
	await heartbeat(ctx, "watcher");
	const hits = await ctx.sync();
	const armed = (await ctx.prisma.policy.findMany({
		where: { status: "armed" },
		include: { position: true, guards: true },
	})) as ArmedPolicy[];
	for (const policy of armed) {
		const hit = matchHit(hits, policy);
		if (!hit) continue;
		const { risk, breach } = ctx.assess(hit, policy);
		if (!breach) continue;
		const claimed = await claimArmed(ctx.prisma, policy.id);
		if (!claimed) continue;
		const guard = policy.guards[0];
		if (!guard) {
			await setPolicyStatus(ctx.prisma, policy.id, "needs_attention");
			continue;
		}
		const run = await ctx.prisma.run.create({
			data: {
				guardId: guard.id,
				khExecutionId: "",
				trigger: "breach",
				status: "pending",
				txHashes: "[]",
				logsJson: "{}",
				beforeSnapshot: snapshotJson(risk),
				afterSnapshot: "{}",
			},
		});
		try {
			const exec = await ctx.kh.executeWorkflow(guard.khWorkflowId, run.id);
			const executionId = parseExecutionId(exec);
			await ctx.prisma.run.update({
				where: { id: run.id },
				data: { khExecutionId: executionId },
			});
		} catch (err) {
			await finalizeFailed(ctx, run.id, policy.id, errorPayload(err));
		}
	}
}

export async function superviseRun(ctx: GuardLoopContext, runId: string): Promise<void> {
	await heartbeat(ctx, "supervisor");
	const run = await ctx.prisma.run.findUnique({
		where: { id: runId },
		include: { guard: true },
	});
	if (!run) {
		throw new Error(`superviseRun: missing run ${runId}`);
	}
	const timeoutMs = ctx.supervisorTimeoutMs ?? SUPERVISOR_TIMEOUT_MS;
	const started = ctx.clock.now();
	let delay = BACKOFF_START_MS;
	while (true) {
		if (ctx.clock.now() - started >= timeoutMs) {
			await finalizeFailed(ctx, run.id, run.guard.policyId, { reason: "timeout" });
			return;
		}
		const raw = await ctx.kh.getExecutionStatus(run.khExecutionId);
		const status = parseExecStatus(raw);
		if (status === "completed") {
			await finalizeSucceeded(ctx, run.id, run.guard.policyId);
			return;
		}
		if (status === "failed") {
			await finalizeFailed(ctx, run.id, run.guard.policyId, asRecord(raw) ?? { status: "failed" });
			return;
		}
		await ctx.clock.sleep(delay);
		delay = Math.min(BACKOFF_CAP_MS, delay * 2);
	}
}

async function finalizeSucceeded(
	ctx: GuardLoopContext,
	runId: string,
	policyId: string,
): Promise<void> {
	const run = await ctx.prisma.run.findUnique({ where: { id: runId } });
	if (!run) throw new Error(`finalizeSucceeded: missing run ${runId}`);
	const execution = await ctx.kh.getExecution(run.khExecutionId);
	const logs = await ctx.kh.getExecutionLogs(run.khExecutionId);
	const hits = await ctx.sync();
	const policy = await ctx.prisma.policy.findUnique({
		where: { id: policyId },
		include: { position: true },
	});
	let after = "{}";
	if (policy) {
		const hit = matchHit(hits, {
			position: {
				marketId: policy.position.marketId,
				walletAddress: policy.position.walletAddress,
			},
		});
		if (hit) {
			after = snapshotJson(ctx.assess(hit, policy).risk);
		}
	}
	await ctx.prisma.run.update({
		where: { id: runId },
		data: {
			status: "succeeded",
			txHashes: JSON.stringify(parseTxHashes(execution)),
			logsJson: JSON.stringify(logs ?? {}),
			costUsd: parseCostUsd(execution),
			afterSnapshot: after,
		},
	});
	await setPolicyStatus(ctx.prisma, policyId, "armed");
	await emitAlert(ctx, {
		runId,
		level: "info",
		payload: JSON.stringify({ status: "succeeded" }),
	});
}

async function finalizeFailed(
	ctx: GuardLoopContext,
	runId: string,
	policyId: string,
	detail: unknown,
): Promise<void> {
	await ctx.prisma.run.update({
		where: { id: runId },
		data: {
			status: "failed",
			logsJson: JSON.stringify(detail),
		},
	});
	await setPolicyStatus(ctx.prisma, policyId, "needs_attention");
	await emitAlert(ctx, {
		runId,
		level: "error",
		payload: JSON.stringify(detail),
	});
}

async function emitAlert(ctx: GuardLoopContext, alert: GuardAlert): Promise<void> {
	await ctx.prisma.alert.create({
		data: {
			runId: alert.runId,
			level: alert.level,
			channel: "telegram",
			payload: alert.payload,
		},
	});
	if (ctx.notify) await ctx.notify(alert);
}

async function claimArmed(prisma: PrismaClient, policyId: string): Promise<boolean> {
	const result = await prisma.policy.updateMany({
		where: { id: policyId, status: "armed" },
		data: { status: "firing" },
	});
	return result.count === 1;
}

async function setPolicyStatus(
	prisma: PrismaClient,
	policyId: string,
	status: string,
): Promise<void> {
	await prisma.policy.update({ where: { id: policyId }, data: { status } });
}

async function heartbeat(ctx: GuardLoopContext, component: string): Promise<void> {
	const lastTickAt = new Date(ctx.clock.now());
	await ctx.prisma.heartbeat.upsert({
		where: { id: component },
		create: {
			id: component,
			component,
			lastTickAt,
			detail: "{}",
		},
		update: { lastTickAt, detail: "{}" },
	});
}

function matchHit(
	hits: PositionSyncHit[],
	policy: { position: { marketId: string; walletAddress: string } },
): PositionSyncHit | undefined {
	const wallet = policy.position.walletAddress.toLowerCase();
	return hits.find(
		(hit) =>
			hit.marketId === policy.position.marketId && hit.walletAddress.toLowerCase() === wallet,
	);
}

function snapshotJson(risk: PositionRisk): string {
	return JSON.stringify({
		borrowAssets: risk.borrowAssets.toString(),
		collateralAssets: risk.collateralAssets.toString(),
		ratioOfLltvPct: risk.ratioOfLltvPct,
	});
}

function parseExecutionId(body: unknown): string {
	const rec = asRecord(body);
	if (rec && typeof rec.executionId === "string" && rec.executionId.length > 0) {
		return rec.executionId;
	}
	if (rec && typeof rec.id === "string" && rec.id.length > 0) {
		return rec.id;
	}
	throw new Error("executeWorkflow: missing executionId");
}

function parseExecStatus(body: unknown): "completed" | "failed" | "running" {
	const rec = asRecord(body);
	const status = typeof rec?.status === "string" ? rec.status.toLowerCase() : "";
	if (status === "completed" || status === "succeeded" || status === "success") {
		return "completed";
	}
	if (status === "failed" || status === "error" || status === "failure") {
		return "failed";
	}
	return "running";
}

function parseTxHashes(body: unknown): string[] {
	const rec = asRecord(body);
	if (!rec) return [];
	const raw = rec.transactionHashes ?? rec.txHashes ?? rec.transactionHash;
	if (typeof raw === "string") return [raw];
	if (Array.isArray(raw)) {
		return raw.filter((item): item is string => typeof item === "string");
	}
	return [];
}

function parseCostUsd(body: unknown): number {
	const rec = asRecord(body);
	if (rec && typeof rec.costUsd === "number") return rec.costUsd;
	return 0;
}

function errorPayload(err: unknown): { error: string } {
	if (err instanceof Error) return { error: err.message };
	return { error: String(err) };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}
