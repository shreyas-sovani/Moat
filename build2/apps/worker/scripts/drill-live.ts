import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, resolveDatabaseUrl } from "@moat/db";
import { REPO_ROOT, explorerTxUrl, loadEnv, loadVerified } from "@moat/infra";
import { KeeperHubClient, KhApiError, idempotencyKey } from "@moat/kh";
import {
	assessWithOracle,
	buildApproveWethCall,
	buildWithdrawCollateralCall,
	drillTopUpGraph,
	reconcileRun,
	simulateThenBroadcast,
	sizeDrill,
} from "../src/drill.ts";
import { superviseRun, tickWatcher } from "../src/guard-loop.ts";
import { createMorphoViemClient, readMorphoOraclePrice } from "../src/morpho-client.ts";
import { syncPositions } from "../src/sync-positions.ts";

function loadDotenv(path: string): void {
	if (!existsSync(path)) return;
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		const line = raw.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 1) continue;
		const key = line.slice(0, eq);
		let value = line.slice(eq + 1);
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadDotenv(join(REPO_ROOT, ".env"));
loadDotenv(join(REPO_ROOT, "../.env"));

const env = loadEnv();
if (!env.KEEPERHUB_API_KEY) {
	console.error("KEEPERHUB_API_KEY missing — 3.5 is a live KeeperHub write");
	process.exit(1);
}
if (!env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID === "0") {
	console.error("TELEGRAM_CHAT_ID missing — notify cannot use chatId 0");
	process.exit(1);
}

const RUN1 = join(REPO_ROOT, "docs/journal/run1");
const GATE35 = join(REPO_ROOT, "docs/journal/3.5");
const STATE_PATH = join(RUN1, "state.json");
const REDACT = "[redacted]";
const chatId = env.TELEGRAM_CHAT_ID;

type DrillState = {
	simulateKey?: string;
	broadcastKey?: string;
	drillTx?: string;
	approveSimKey?: string;
	approveKey?: string;
	approveTx?: string;
	saveTxs?: string[];
	runId?: string;
	workflowId?: string;
	sized?: unknown;
};

function redactValue(value: unknown, secret: string): unknown {
	if (typeof value === "string") {
		if (secret.length === 0) return value;
		if (value === secret) return REDACT;
		if (value.includes(secret)) return value.split(secret).join(REDACT);
		return value;
	}
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "bigint") return value.toString();
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, secret));
	}
	if (typeof value === "object" && value !== null) {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			if (key === "chatId") out[key] = REDACT;
			else out[key] = redactValue(item, secret);
		}
		return out;
	}
	return value;
}

function writeJson(dir: string, name: string, value: unknown): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, name), `${JSON.stringify(redactValue(value, chatId), null, "\t")}\n`);
}

function writeBoth(name: string, value: unknown): void {
	writeJson(RUN1, name, value);
	writeJson(GATE35, name, value);
}

function errorJournal(err: unknown): Record<string, unknown> {
	if (err instanceof KhApiError) {
		return { name: err.name, message: err.message, status: err.status, body: err.body };
	}
	if (err instanceof Error) {
		return { name: err.name, message: err.message };
	}
	return { error: String(err) };
}

function loadState(): DrillState {
	if (!existsSync(STATE_PATH)) return {};
	try {
		const parsed: unknown = JSON.parse(readFileSync(STATE_PATH, "utf8"));
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as DrillState;
		}
	} catch {
		return {};
	}
	return {};
}

function saveState(state: DrillState): void {
	writeJson(RUN1, "state.json", state);
}

function as0x(value: string): `0x${string}` {
	if (!value.startsWith("0x")) {
		throw new Error("expected 0x-prefixed hex");
	}
	return value as `0x${string}`;
}

function snapshotFromRisk(risk: {
	ratioOfLltvPct: number;
	borrowAssets: bigint;
	collateralAssets: bigint;
}) {
	return {
		borrowAssets: risk.borrowAssets.toString(),
		collateralAssets: risk.collateralAssets.toString(),
		ratioOfLltvPct: risk.ratioOfLltvPct,
	};
}

const verified = loadVerified();
const dbUrl = resolveDatabaseUrl(env.DATABASE_URL);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const kh = new KeeperHubClient();
const client = createMorphoViemClient({
	rpcUrl: env.RPC_URL_84532,
	chainId: verified.network.chainId,
	chainName: verified.network.name,
});
const market = verified.morpho.markets[0];
if (!market) {
	console.error("verified.json has no morpho markets");
	process.exit(1);
}

try {
	const state = loadState();
	writeBoth("integrations.json", await kh.listIntegrations());
	writeBoth("spend-cap.json", await kh.getSpendCap());

	const hits = await syncPositions({ verified, prisma, client, now: new Date() });
	const hit = hits[0];
	if (!hit) throw new Error("sync returned no positions");
	let oraclePrice = await readMorphoOraclePrice({
		rpcUrl: env.RPC_URL_84532,
		chainId: verified.network.chainId,
		chainName: verified.network.name,
		oracle: as0x(market.oracle),
	});
	const liveRisk = assessWithOracle(hit, market, oraclePrice, 110);
	writeBoth("live-risk.json", {
		oraclePrice: oraclePrice.toString(),
		risk: snapshotFromRisk(liveRisk.risk),
		breach: liveRisk.breach,
		collateralWei: hit.blue.collateral.toString(),
	});

	const savedSized = reviveSized(state.sized);
	const sized =
		state.drillTx && savedSized
			? savedSized
			: sizeDrill({
					ratioOfLltvPct: liveRisk.risk.ratioOfLltvPct,
					collateralWei: hit.blue.collateral,
					triggerRatioPct: 110,
				});
	if (!state.drillTx) {
		state.sized = {
			...sized,
			withdrawAssets: sized.withdrawAssets.toString(),
			remainingCollateralWei: sized.remainingCollateralWei.toString(),
			topUpAssets: sized.topUpAssets.toString(),
		};
		writeBoth("before-risk.json", {
			oraclePrice: oraclePrice.toString(),
			risk: snapshotFromRisk(liveRisk.risk),
			breach: liveRisk.breach,
			collateralWei: hit.blue.collateral.toString(),
		});
		writeBoth("sized.json", state.sized);
	}
	if (sized.withdrawAssets <= 0n && !state.drillTx) {
		throw new Error("sizeDrill produced a zero withdraw — refusing to broadcast");
	}

	const guard = await prisma.guard.findFirst({
		include: { policy: true, plan: true },
		orderBy: { createdAt: "asc" },
	});
	if (!guard) {
		throw new Error(
			"no Guard row — restore packages/db/prisma/dev.db from journal/3.4 or run arm:plan",
		);
	}
	state.workflowId = guard.khWorkflowId;
	writeBoth("guard.json", { guard, policy: guard.policy, plan: guard.plan });

	const existingRun = await prisma.run.findFirst({
		where: { guardId: guard.id },
		orderBy: { startedAt: "desc" },
	});
	if (!state.runId && existingRun && existingRun.status !== "failed") {
		state.runId = existingRun.id;
		saveState(state);
	}
	if (state.runId) {
		const current = await prisma.run.findUnique({ where: { id: state.runId } });
		if (!current) {
			state.runId = undefined;
			saveState(state);
		} else if (current.status === "failed" && current.khExecutionId.length === 0) {
			state.runId = undefined;
			saveState(state);
		}
	}

	const graph = drillTopUpGraph({
		verified,
		chatId,
		topUpAssets: sized.topUpAssets.toString(),
	});
	writeBoth("updated-graph.json", graph);
	if (!state.drillTx) {
		await prisma.policy.update({
			where: { id: guard.policyId },
			data: { status: "draft" },
		});
		writeBoth(
			"update-workflow.json",
			await kh.updateWorkflow(guard.khWorkflowId, { ...graph, enabled: true }),
		);
		await prisma.plan.update({
			where: { id: guard.planId },
			data: {
				workflowJson: JSON.stringify(graph),
				planOptions: JSON.stringify([
					{
						kind: "top_up",
						assets: sized.topUpAssets.toString(),
						projectedRatioPct: sized.projectedAfterRatioPct,
					},
				]),
			},
		});
	}

	if (!state.simulateKey) state.simulateKey = idempotencyKey("drill-sim", randomUUID());
	if (!state.broadcastKey) state.broadcastKey = idempotencyKey("drill", randomUUID());
	saveState(state);

	if (!state.drillTx) {
		const call = buildWithdrawCollateralCall({ verified, assets: sized.withdrawAssets });
		writeBoth("withdraw-call.json", call);
		const drilled = await simulateThenBroadcast({
			kh,
			call,
			simulateKey: state.simulateKey,
			broadcastKey: state.broadcastKey,
		});
		writeBoth("withdraw-simulate.json", drilled.simulate);
		writeBoth("withdraw-broadcast.json", drilled.broadcast);
		state.drillTx = drilled.transactionHash;
		saveState(state);
	}
	writeBoth("drill-tx.json", {
		transactionHash: state.drillTx,
		explorer: explorerTxUrl(verified, state.drillTx ?? ""),
	});

	if (!state.approveSimKey) state.approveSimKey = idempotencyKey("approve-sim", randomUUID());
	if (!state.approveKey) state.approveKey = idempotencyKey("approve", randomUUID());
	saveState(state);
	if (!state.approveTx) {
		const approveCall = buildApproveWethCall({ verified, assets: sized.topUpAssets });
		writeBoth("approve-call.json", approveCall);
		const approved = await simulateThenBroadcast({
			kh,
			call: approveCall,
			simulateKey: state.approveSimKey,
			broadcastKey: state.approveKey,
		});
		writeBoth("approve-simulate.json", approved.simulate);
		writeBoth("approve-broadcast.json", approved.broadcast);
		state.approveTx = approved.transactionHash;
		saveState(state);
	}
	writeBoth("approve-tx.json", {
		transactionHash: state.approveTx,
		explorer: explorerTxUrl(verified, state.approveTx ?? ""),
	});

	const afterHits = await syncPositions({ verified, prisma, client, now: new Date() });
	const afterHit = afterHits[0];
	if (!afterHit) throw new Error("post-drill sync returned no positions");
	oraclePrice = await readMorphoOraclePrice({
		rpcUrl: env.RPC_URL_84532,
		chainId: verified.network.chainId,
		chainName: verified.network.name,
		oracle: as0x(market.oracle),
	});
	const afterDrill = assessWithOracle(afterHit, market, oraclePrice, 110);
	writeBoth("after-drill-risk.json", {
		oraclePrice: oraclePrice.toString(),
		risk: snapshotFromRisk(afterDrill.risk),
		breach: afterDrill.breach,
		collateralWei: afterHit.blue.collateral.toString(),
	});

	if (!state.runId) {
		await prisma.policy.update({
			where: { id: guard.policyId },
			data: { status: "armed", armedAt: new Date() },
		});
		await prisma.guard.update({
			where: { id: guard.id },
			data: { status: "armed" },
		});
	}

	const assess = (syncHit: typeof hit, policy: { triggerRatioPct: number }) =>
		assessWithOracle(syncHit, market, oraclePrice, policy.triggerRatioPct);
	const loop = {
		prisma,
		sync: () => syncPositions({ verified, prisma, client, now: new Date() }),
		kh,
		assess,
		clock: {
			now: () => Date.now(),
			sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
		},
	};

	if (!state.runId) {
		await tickWatcher(loop);
		const run = await prisma.run.findFirst({
			where: { guardId: guard.id },
			orderBy: { startedAt: "desc" },
		});
		if (!run) {
			throw new Error("tickWatcher created no Run — policy may not have been armed/breaching");
		}
		state.runId = run.id;
		saveState(state);
	}

	const pending = await prisma.run.findUnique({ where: { id: state.runId } });
	if (!pending) throw new Error(`missing run ${state.runId}`);
	writeBoth("run-pending.json", pending);
	if (pending.status !== "succeeded") {
		if (pending.khExecutionId.length === 0) {
			throw new Error(`run ${pending.id} has no khExecutionId — refusing to supervise`);
		}
		oraclePrice = await readMorphoOraclePrice({
			rpcUrl: env.RPC_URL_84532,
			chainId: verified.network.chainId,
			chainName: verified.network.name,
			oracle: as0x(market.oracle),
		});
		await superviseRun(loop, pending.id);
	}

	const done = await prisma.run.findUnique({ where: { id: pending.id } });
	if (!done) throw new Error("run disappeared");
	writeBoth("run-row.json", done);
	if (done.khExecutionId) {
		writeBoth("execution.json", await kh.getExecution(done.khExecutionId));
		writeBoth("execution-logs.json", await kh.getExecutionLogs(done.khExecutionId));
	}

	const reconciled = await reconcileRun(prisma, done.id);
	const finalRun = await prisma.run.findUnique({ where: { id: done.id } });
	if (!finalRun) throw new Error("run disappeared after reconcile");
	writeBoth("run-final.json", finalRun);

	const saveTxs = JSON.parse(finalRun.txHashes) as unknown;
	const saveList = Array.isArray(saveTxs)
		? saveTxs.filter((item): item is string => typeof item === "string")
		: [];
	state.saveTxs = saveList;
	saveState(state);

	const beforeRatio = asRatio(finalRun.beforeSnapshot);
	const afterRatio = asRatio(finalRun.afterSnapshot);
	const hashes = [state.drillTx, state.approveTx, ...saveList].filter(
		(item): item is string => typeof item === "string" && item.startsWith("0x"),
	);
	const unique = [...new Set(hashes)];
	const links = unique.map((hash) => explorerTxUrl(verified, hash));
	writeBoth("tx-links.json", { hashes: unique, links });
	writeBoth("ratios.json", {
		beforeRatio,
		afterRatio,
		delta: beforeRatio !== undefined && afterRatio !== undefined ? beforeRatio - afterRatio : null,
	});

	const ac1 = unique.length >= 2;
	const ac2 =
		finalRun.status === "succeeded" &&
		saveList.length > 0 &&
		finalRun.logsJson.length > 2 &&
		finalRun.reconciledAt !== null &&
		reconciled;
	const ac3 =
		beforeRatio !== undefined &&
		afterRatio !== undefined &&
		afterRatio < beforeRatio &&
		beforeRatio - afterRatio >= 15;
	const summary = {
		ok: ac1 && ac2 && ac3,
		ac1,
		ac2,
		ac3,
		workflowId: guard.khWorkflowId,
		runId: finalRun.id,
		drillTx: state.drillTx,
		saveTxs: saveList,
		links,
		status: finalRun.status,
		reconciledAt: finalRun.reconciledAt,
		beforeRatio,
		afterRatio,
		databaseUrlKind: dbUrl.startsWith("file:") ? "sqlite-file" : "other",
	};
	writeBoth("summary.json", summary);
	console.log(JSON.stringify(redactValue(summary, chatId)));
	if (!summary.ok) process.exitCode = 1;
} catch (err) {
	writeBoth("error.json", { ok: false, error: errorJournal(err) });
	console.error("drill failed — see docs/journal/run1/error.json");
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}

function asRatio(raw: string): number | undefined {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && "ratioOfLltvPct" in parsed) {
			const value = (parsed as { ratioOfLltvPct: unknown }).ratioOfLltvPct;
			return typeof value === "number" ? value : undefined;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function reviveSized(raw: unknown): ReturnType<typeof sizeDrill> | undefined {
	if (typeof raw !== "object" || raw === null) return undefined;
	const rec = raw as Record<string, unknown>;
	if (typeof rec.withdrawAssets !== "string" || typeof rec.topUpAssets !== "string") {
		return undefined;
	}
	if (typeof rec.remainingCollateralWei !== "string") return undefined;
	if (typeof rec.requestedTargetRatioPct !== "number") return undefined;
	if (typeof rec.targetRatioPct !== "number") return undefined;
	if (typeof rec.dropPct !== "number") return undefined;
	if (typeof rec.beforeRatioPct !== "number") return undefined;
	if (typeof rec.projectedAfterRatioPct !== "number") return undefined;
	return {
		requestedTargetRatioPct: rec.requestedTargetRatioPct,
		targetRatioPct: rec.targetRatioPct,
		dropPct: rec.dropPct,
		withdrawAssets: BigInt(rec.withdrawAssets),
		remainingCollateralWei: BigInt(rec.remainingCollateralWei),
		topUpAssets: BigInt(rec.topUpAssets),
		beforeRatioPct: rec.beforeRatioPct,
		projectedAfterRatioPct: rec.projectedAfterRatioPct,
	};
}
