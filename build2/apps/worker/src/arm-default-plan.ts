import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@moat/db";
import type { Verified } from "@moat/infra";
import { type GraphJson, idempotencyKey, validateGraphJson, wf } from "@moat/kh";
import { DEFAULT_POLICY, PolicySchema } from "@moat/policy";
import { MORPHO_SUPPLY_COLLATERAL_ABI } from "@moat/risk";
import { positionRowId } from "./sync-positions.js";

/** 0.001 WETH in wei — Morpho `assets` is uint256, not a decimal ether string. */
export const DEFAULT_TOP_UP_ASSETS = "1000000000000000";
export const DEFAULT_PLAN_NAME = "moat-default-top-up";

export interface ArmKh {
	createWorkflow(graph: GraphJson, key: string, enabled?: boolean): Promise<unknown>;
	listWorkflows(): Promise<unknown>;
	updateWorkflow(id: string, patch: Record<string, unknown>): Promise<unknown>;
}

export interface ArmDefaultPlanInput {
	prisma: PrismaClient;
	verified: Verified;
	kh: ArmKh;
	chatId: string;
	uuid?: () => string;
	topUpAssets?: string;
	now?: Date;
}

export interface ArmDefaultPlanResult {
	created: boolean;
	guardId: string;
	planId: string;
	policyId: string;
	workflowId: string;
	enabled: boolean;
	idempotencyKey: string;
	listed: unknown;
	graph: GraphJson;
}

export function bufferUsdFromVerified(verified: Verified): number {
	const raw = verified.keeperhub.wallet.balances?.usdc;
	const parsed = raw === undefined ? Number.NaN : Number(raw);
	if (Number.isFinite(parsed) && parsed > 0) return parsed;
	return DEFAULT_POLICY.maxSpendUsd;
}

export function buildDefaultTopUpGraph(input: {
	verified: Verified;
	chatId: string;
	topUpAssets: string;
}): GraphJson {
	if (input.chatId.trim().length === 0 || input.chatId === "0") {
		throw new Error('telegram chatId is required (not empty, not "0")');
	}
	const market = input.verified.morpho.markets[0];
	if (!market) {
		throw new Error("verified.json has no morpho markets");
	}
	const weth = input.verified.tokens.WETH;
	if (!weth) {
		throw new Error("verified.json missing tokens.WETH");
	}
	const guardian = input.verified.keeperhub.wallet.address;
	const tokenConfig = JSON.stringify({
		mode: "custom",
		customToken: { address: weth.address, symbol: weth.symbol },
	});
	return wf(DEFAULT_PLAN_NAME, "hand-coded Morpho collateral top-up guard")
		.trigger("Manual")
		.action({
			id: "read-weth",
			actionType: "web3/check-token-balance",
			label: "Check WETH",
			config: {
				address: guardian,
				tokenConfig,
			},
		})
		.condition("cond-1", {
			left: "{{@read-weth:Check WETH.balance}}",
			operator: ">=",
			right: input.topUpAssets,
		})
		.action({
			id: "top-up",
			if: "true",
			actionType: "web3/write-contract",
			label: "Supply Collateral",
			config: {
				contractAddress: input.verified.morpho.blue,
				abi: JSON.stringify(MORPHO_SUPPLY_COLLATERAL_ABI),
				abiFunction: "supplyCollateral",
				functionArgs: JSON.stringify([
					{
						loanToken: market.loanToken,
						collateralToken: market.collateralToken,
						oracle: market.oracle,
						irm: market.irm,
						lltv: market.lltv,
					},
					input.topUpAssets,
					guardian,
					"0x",
				]),
			},
		})
		.action({
			id: "skip",
			if: "false",
			actionType: "web3/check-balance",
			label: "Insufficient Buffer",
			config: { address: guardian },
		})
		.notify("notify-1", input.chatId, "Moat default top-up guard ran on Base Sepolia")
		.build();
}

export async function armDefaultPlan(input: ArmDefaultPlanInput): Promise<ArmDefaultPlanResult> {
	const chatId = input.chatId.trim();
	if (chatId.length === 0 || chatId === "0") {
		throw new Error('telegram chatId is required (not empty, not "0")');
	}
	const now = input.now ?? new Date();
	const topUpAssets = input.topUpAssets ?? DEFAULT_TOP_UP_ASSETS;
	const graph = validateGraphJson(
		buildDefaultTopUpGraph({
			verified: input.verified,
			chatId,
			topUpAssets,
		}),
	);
	const market = requireMarket(input.verified);
	const guardian = input.verified.keeperhub.wallet.address;
	const policyParams = PolicySchema.parse({
		triggerRatioPct: 110,
		maxSpendUsd: bufferUsdFromVerified(input.verified),
		allowedActions: ["top_up"],
		slippageBps: DEFAULT_POLICY.slippageBps,
		circuitBreakerMaxRunsPerDay: DEFAULT_POLICY.circuitBreakerMaxRunsPerDay,
	});

	const user = await ensureUser(input.prisma);
	await ensureWallet(input.prisma, user.id, guardian);
	await upsertMarket(input.prisma, input.verified, market);
	const positionId = await ensurePosition(input.prisma, market.id, guardian, now);
	const policy = await upsertPolicy(input.prisma, positionId, policyParams);

	const existing = await input.prisma.guard.findFirst({
		where: { policyId: policy.id },
		orderBy: { createdAt: "asc" },
	});
	if (existing) {
		const enabled = await ensureWorkflowEnabled(input.kh, existing.khWorkflowId);
		const listed = await input.kh.listWorkflows();
		await input.prisma.guard.update({
			where: { id: existing.id },
			data: { status: "armed" },
		});
		await input.prisma.policy.update({
			where: { id: policy.id },
			data: { status: "armed", armedAt: now },
		});
		return {
			created: false,
			guardId: existing.id,
			planId: existing.planId,
			policyId: policy.id,
			workflowId: existing.khWorkflowId,
			enabled,
			idempotencyKey: existing.khIdempotencyKey,
			listed,
			graph,
		};
	}

	const planKey = idempotencyKey("plan", (input.uuid ?? randomUUID)());
	const createdBody = await input.kh.createWorkflow(graph, planKey, true);
	const workflowId = parseWorkflowId(createdBody);
	if (!workflowId) {
		throw new Error("createWorkflow did not return a workflow id");
	}
	const enabled = await ensureWorkflowEnabled(input.kh, workflowId, createdBody);
	const listed = await input.kh.listWorkflows();

	const plan = await input.prisma.plan.create({
		data: {
			policyId: policy.id,
			workflowJson: JSON.stringify(graph),
			rationale: "hand-coded default top-up (no LLM)",
			planOptions: JSON.stringify([{ kind: "top_up", assets: topUpAssets }]),
			criticVerdict: JSON.stringify({ skipped: true, reason: "phase-3 default" }),
			simulateResult: JSON.stringify({
				skipped: true,
				reason: "3.4 arms the plan; 3.5 simulates the drill",
			}),
			status: "approved",
			approvedAt: now,
			humanOverride: true,
		},
	});
	const guard = await input.prisma.guard.create({
		data: {
			policyId: policy.id,
			planId: plan.id,
			khWorkflowId: workflowId,
			khIdempotencyKey: planKey,
			status: "armed",
		},
	});
	await input.prisma.policy.update({
		where: { id: policy.id },
		data: { status: "armed", armedAt: now },
	});
	return {
		created: true,
		guardId: guard.id,
		planId: plan.id,
		policyId: policy.id,
		workflowId,
		enabled,
		idempotencyKey: planKey,
		listed,
		graph,
	};
}

function requireMarket(verified: Verified): Verified["morpho"]["markets"][number] {
	const market = verified.morpho.markets[0];
	if (!market) {
		throw new Error("verified.json has no morpho markets");
	}
	return market;
}

async function ensureUser(prisma: PrismaClient) {
	const existing = await prisma.user.findFirst({ where: { khOrgId: "moat" } });
	if (existing) return existing;
	return prisma.user.create({ data: { khOrgId: "moat" } });
}

async function ensureWallet(prisma: PrismaClient, userId: string, address: string) {
	const existing = await prisma.wallet.findFirst({ where: { userId, address } });
	if (existing) return existing;
	return prisma.wallet.create({
		data: { userId, address, role: "guardian" },
	});
}

async function upsertMarket(
	prisma: PrismaClient,
	verified: Verified,
	market: Verified["morpho"]["markets"][number],
) {
	await prisma.market.upsert({
		where: { id: market.id },
		create: {
			id: market.id,
			loanToken: market.loanToken,
			collateralToken: market.collateralToken,
			lltv: market.lltv,
			oracle: market.oracle,
			irm: market.irm,
			chainId: verified.network.chainId,
		},
		update: {
			loanToken: market.loanToken,
			collateralToken: market.collateralToken,
			lltv: market.lltv,
			oracle: market.oracle,
			irm: market.irm,
			chainId: verified.network.chainId,
		},
	});
}

async function ensurePosition(
	prisma: PrismaClient,
	marketId: string,
	walletAddress: string,
	now: Date,
): Promise<string> {
	const id = positionRowId(marketId, walletAddress);
	const existing = await prisma.position.findUnique({ where: { id } });
	if (existing) return existing.id;
	const created = await prisma.position.create({
		data: {
			id,
			marketId,
			walletAddress,
			borrowShares: "0",
			collateralShares: "0",
			snapshotAt: now,
		},
	});
	return created.id;
}

async function upsertPolicy(
	prisma: PrismaClient,
	positionId: string,
	params: {
		triggerRatioPct: number;
		maxSpendUsd: number;
		allowedActions: string[];
		slippageBps: number;
		circuitBreakerMaxRunsPerDay: number;
	},
) {
	const existing = await prisma.policy.findFirst({
		where: { positionId },
		orderBy: { createdAt: "asc" },
	});
	const data = {
		triggerRatioPct: params.triggerRatioPct,
		maxSpendUsd: params.maxSpendUsd,
		allowedActions: params.allowedActions.join(","),
		slippageBps: params.slippageBps,
		circuitBreakerMaxRunsPerDay: params.circuitBreakerMaxRunsPerDay,
	};
	if (existing) {
		return prisma.policy.update({ where: { id: existing.id }, data });
	}
	return prisma.policy.create({
		data: { positionId, status: "draft", ...data },
	});
}

async function ensureWorkflowEnabled(
	kh: ArmKh,
	workflowId: string,
	createdBody?: unknown,
): Promise<boolean> {
	const listed = await kh.listWorkflows();
	const row = findWorkflowRow(listed, workflowId);
	const fromList = row ? parseEnabled(row) : undefined;
	const fromCreate = parseEnabled(createdBody);
	if (fromList === true || (fromList === undefined && fromCreate === true)) {
		return true;
	}
	await kh.updateWorkflow(workflowId, { enabled: true });
	return true;
}

function findWorkflowRow(body: unknown, id: string): Record<string, unknown> | undefined {
	for (const row of workflowRecords(body)) {
		if (row.id === id) return row;
	}
	return undefined;
}

function workflowRecords(body: unknown): Record<string, unknown>[] {
	let rows: unknown;
	if (Array.isArray(body)) {
		rows = body;
	} else {
		const rec = asRecord(body);
		if (rec && Array.isArray(rec.workflows)) rows = rec.workflows;
		else if (rec && Array.isArray(rec.data)) rows = rec.data;
		else rows = [];
	}
	if (!Array.isArray(rows)) return [];
	const out: Record<string, unknown>[] = [];
	for (const row of rows) {
		const rec = asRecord(row);
		if (rec && typeof rec.id === "string") out.push(rec);
	}
	return out;
}

export function parseWorkflowId(body: unknown): string | undefined {
	const rec = asRecord(body);
	if (!rec) return undefined;
	if (typeof rec.id === "string") return rec.id;
	if (typeof rec.workflowId === "string") return rec.workflowId;
	const inner = asRecord(rec.workflow);
	if (inner && typeof inner.id === "string") return inner.id;
	return undefined;
}

function parseEnabled(body: unknown): boolean | undefined {
	const rec = asRecord(body);
	if (!rec) return undefined;
	if (typeof rec.enabled === "boolean") return rec.enabled;
	if (typeof rec.isEnabled === "boolean") return rec.isEnabled;
	return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === "object" && value !== null && Array.isArray(value) === false) {
		return value as Record<string, unknown>;
	}
	return undefined;
}
