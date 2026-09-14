import type { PrismaClient } from "@moat/db";
import type { Verified } from "@moat/infra";
import { type GraphJson, validateGraphJson } from "@moat/kh";
import {
	ERC20_APPROVE_ABI,
	MORPHO_WITHDRAW_COLLATERAL_ABI,
	type MorphoMarketInfo,
	adjustRawToLoanUnits,
	breachDetected,
	computePositionRisk,
} from "@moat/risk";
import { buildDefaultTopUpGraph } from "./arm-default-plan.js";
import type { AssessResult } from "./guard-loop.js";
import type { PositionSyncHit } from "./sync-positions.js";

export const DRILL_MAX_SAFE_RATIO_PCT = 99;
export const DRILL_RATIO_SCALE = 1_000_000n;

export interface DrillKh {
	directContractCall(body: Record<string, unknown>, key: string): Promise<unknown>;
	getDirectExecutionStatus?(executionId: string): Promise<unknown>;
}

export interface SizedDrill {
	requestedTargetRatioPct: number;
	targetRatioPct: number;
	dropPct: number;
	withdrawAssets: bigint;
	remainingCollateralWei: bigint;
	topUpAssets: bigint;
	beforeRatioPct: number;
	projectedAfterRatioPct: number;
}

export function dropPctForTargetRatio(r0: number, target: number): number {
	if (Number.isNaN(r0) || Number.isNaN(target)) {
		throw new Error("NaN ratio is not a valid drop-pct input");
	}
	if (r0 >= target) return 0;
	const raw = (1 - r0 / target) * 100;
	const clamped = Math.min(50, Math.max(0, raw));
	return Math.round(clamped * 100) / 100;
}

export function sizeDrill(input: {
	ratioOfLltvPct: number;
	collateralWei: bigint;
	triggerRatioPct: number;
	maxSafeRatioPct?: number;
}): SizedDrill {
	const requestedTargetRatioPct = input.triggerRatioPct + 5;
	const maxSafe = input.maxSafeRatioPct ?? DRILL_MAX_SAFE_RATIO_PCT;
	const targetRatioPct = Math.min(requestedTargetRatioPct, maxSafe);
	if (input.collateralWei <= 0n) {
		throw new Error("sizeDrill: collateralWei must be positive");
	}
	if (targetRatioPct <= input.ratioOfLltvPct) {
		return {
			requestedTargetRatioPct,
			targetRatioPct,
			dropPct: 0,
			withdrawAssets: 0n,
			remainingCollateralWei: input.collateralWei,
			topUpAssets: 0n,
			beforeRatioPct: input.ratioOfLltvPct,
			projectedAfterRatioPct: input.ratioOfLltvPct,
		};
	}
	const r0s = BigInt(Math.round(input.ratioOfLltvPct * Number(DRILL_RATIO_SCALE)));
	const targetS = BigInt(Math.round(targetRatioPct * Number(DRILL_RATIO_SCALE)));
	const remainingCollateralWei = (input.collateralWei * r0s) / targetS;
	if (remainingCollateralWei <= 0n || remainingCollateralWei >= input.collateralWei) {
		throw new Error("sizeDrill: remaining collateral is not a valid withdraw");
	}
	const withdrawAssets = input.collateralWei - remainingCollateralWei;
	const beforeScaled = (r0s * input.collateralWei) / remainingCollateralWei;
	return {
		requestedTargetRatioPct,
		targetRatioPct,
		dropPct: dropPctForTargetRatio(input.ratioOfLltvPct, targetRatioPct),
		withdrawAssets,
		remainingCollateralWei,
		topUpAssets: withdrawAssets,
		beforeRatioPct: Number(beforeScaled) / Number(DRILL_RATIO_SCALE),
		projectedAfterRatioPct: input.ratioOfLltvPct,
	};
}

export function buildWithdrawCollateralCall(input: {
	verified: Verified;
	assets: bigint;
}): Record<string, unknown> {
	const market = input.verified.morpho.markets[0];
	if (!market) {
		throw new Error("verified.json has no morpho markets");
	}
	if (input.assets <= 0n) {
		throw new Error("withdrawCollateral assets must be positive");
	}
	const guardian = input.verified.keeperhub.wallet.address;
	return {
		contractAddress: input.verified.morpho.blue,
		chainId: input.verified.network.chainId,
		functionName: "withdrawCollateral",
		abi: JSON.stringify(MORPHO_WITHDRAW_COLLATERAL_ABI),
		functionArgs: JSON.stringify([
			{
				loanToken: market.loanToken,
				collateralToken: market.collateralToken,
				oracle: market.oracle,
				irm: market.irm,
				lltv: market.lltv,
			},
			input.assets.toString(),
			guardian,
			guardian,
		]),
	};
}

export function buildApproveWethCall(input: {
	verified: Verified;
	assets: bigint;
}): Record<string, unknown> {
	const weth = input.verified.tokens.WETH;
	if (!weth) {
		throw new Error("verified.json missing tokens.WETH");
	}
	if (input.assets <= 0n) {
		throw new Error("approve assets must be positive");
	}
	return {
		contractAddress: weth.address,
		chainId: input.verified.network.chainId,
		functionName: "approve",
		abi: JSON.stringify(ERC20_APPROVE_ABI),
		functionArgs: JSON.stringify([input.verified.morpho.blue, input.assets.toString()]),
	};
}

export function assessWithOracle(
	hit: PositionSyncHit,
	market: { lltv: string; loanToken: string; collateralToken: string; oracle: string },
	oraclePrice: bigint,
	triggerRatioPct: number,
): AssessResult {
	const info: MorphoMarketInfo = {
		lltv: BigInt(market.lltv),
		loanToken: market.loanToken,
		collateralToken: market.collateralToken,
		oracle: market.oracle,
	};
	const risk = computePositionRisk(adjustRawToLoanUnits(hit.raw, oraclePrice), info);
	return { risk, breach: breachDetected(risk, { triggerRatioPct }) };
}

export function parseTxHash(body: unknown): string | undefined {
	const rec = asRecord(body);
	if (!rec) return undefined;
	if (typeof rec.transactionHash === "string" && rec.transactionHash.startsWith("0x")) {
		return rec.transactionHash;
	}
	if (typeof rec.txHash === "string" && rec.txHash.startsWith("0x")) {
		return rec.txHash;
	}
	if (Array.isArray(rec.transactionHashes)) {
		const first = rec.transactionHashes.find(
			(item): item is string => typeof item === "string" && item.startsWith("0x"),
		);
		if (first) return first;
	}
	const receipts = rec.receipts;
	if (Array.isArray(receipts) && receipts[0]) {
		const hash = asRecord(receipts[0])?.hash;
		if (typeof hash === "string" && hash.startsWith("0x")) return hash;
	}
	const inner = asRecord(rec.result);
	if (inner && typeof inner.transactionHash === "string") return inner.transactionHash;
	return undefined;
}

export function shouldReconcile(input: {
	beforeRatio: number;
	afterRatio: number;
	projectedRatio: number;
}): boolean {
	const projectedDelta = input.beforeRatio - input.projectedRatio;
	if (projectedDelta <= 0) {
		return input.afterRatio >= input.projectedRatio * 0.8;
	}
	const actualDelta = input.beforeRatio - input.afterRatio;
	return actualDelta >= projectedDelta * 0.8;
}

export async function reconcileRun(
	prisma: PrismaClient,
	runId: string,
	at = new Date(),
): Promise<boolean> {
	const run = await prisma.run.findUnique({
		where: { id: runId },
		include: { guard: { include: { plan: true } } },
	});
	if (!run) throw new Error(`reconcileRun: missing run ${runId}`);
	const before = snapshotRatio(run.beforeSnapshot);
	const after = snapshotRatio(run.afterSnapshot);
	const projected = projectedRatioFromPlan(run.guard.plan.planOptions);
	if (before === undefined || after === undefined || projected === undefined) {
		return false;
	}
	if (!shouldReconcile({ beforeRatio: before, afterRatio: after, projectedRatio: projected })) {
		return false;
	}
	await prisma.run.update({
		where: { id: runId },
		data: { reconciledAt: at },
	});
	return true;
}

export async function simulateThenBroadcast(input: {
	kh: DrillKh;
	call: Record<string, unknown>;
	simulateKey: string;
	broadcastKey: string;
	sleep?: (ms: number) => Promise<void>;
}): Promise<{ simulate: unknown; broadcast: unknown; transactionHash: string }> {
	if (input.simulateKey === input.broadcastKey) {
		throw new Error("simulate and broadcast must use different idempotency keys");
	}
	const simulate = await input.kh.directContractCall(
		{ ...input.call, simulate: true },
		input.simulateKey,
	);
	if (wouldRevert(simulate)) {
		throw new Error("simulate wouldRevert");
	}
	const broadcast = await input.kh.directContractCall({ ...input.call }, input.broadcastKey);
	let transactionHash = parseTxHash(broadcast);
	const executionId = parseExecutionId(broadcast);
	const status = parseStatus(broadcast);
	if (!transactionHash && executionId && input.kh.getDirectExecutionStatus) {
		const sleep =
			input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
		let last: unknown = broadcast;
		for (let i = 0; i < 40; i += 1) {
			last = await input.kh.getDirectExecutionStatus(executionId);
			transactionHash = parseTxHash(last);
			const polled = parseStatus(last);
			if (transactionHash || polled === "failed") {
				return requireHash({
					simulate,
					broadcast: last,
					transactionHash,
					failed: polled === "failed",
				});
			}
			await sleep(2000);
		}
		return requireHash({ simulate, broadcast: last, transactionHash, failed: false });
	}
	return requireHash({
		simulate,
		broadcast,
		transactionHash,
		failed: status === "failed",
	});
}

export function drillTopUpGraph(input: {
	verified: Verified;
	chatId: string;
	topUpAssets: string;
}): GraphJson {
	return validateGraphJson(
		buildDefaultTopUpGraph({
			...input,
			balanceField: "balance.balanceRaw",
		}),
	);
}

function requireHash(input: {
	simulate: unknown;
	broadcast: unknown;
	transactionHash: string | undefined;
	failed: boolean;
}): { simulate: unknown; broadcast: unknown; transactionHash: string } {
	if (input.failed) {
		throw new Error("direct execution failed");
	}
	if (!input.transactionHash) {
		throw new Error("broadcast missing transactionHash");
	}
	return {
		simulate: input.simulate,
		broadcast: input.broadcast,
		transactionHash: input.transactionHash,
	};
}

function wouldRevert(body: unknown): boolean {
	const rec = asRecord(body);
	return rec?.wouldRevert === true || rec?.success === false;
}

function parseExecutionId(body: unknown): string | undefined {
	const rec = asRecord(body);
	if (rec && typeof rec.executionId === "string" && rec.executionId.length > 0) {
		return rec.executionId;
	}
	if (rec && typeof rec.id === "string" && rec.id.length > 0) {
		return rec.id;
	}
	return undefined;
}

function parseStatus(body: unknown): string {
	const rec = asRecord(body);
	return typeof rec?.status === "string" ? rec.status.toLowerCase() : "";
}

function snapshotRatio(raw: string): number | undefined {
	try {
		const rec = asRecord(JSON.parse(raw));
		if (rec && typeof rec.ratioOfLltvPct === "number") return rec.ratioOfLltvPct;
	} catch {
		return undefined;
	}
	return undefined;
}

function projectedRatioFromPlan(planOptions: string): number | undefined {
	try {
		const parsed: unknown = JSON.parse(planOptions);
		if (!Array.isArray(parsed)) return undefined;
		for (const row of parsed) {
			const rec = asRecord(row);
			if (rec && typeof rec.projectedRatioPct === "number") return rec.projectedRatioPct;
		}
	} catch {
		return undefined;
	}
	return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === "object" && value !== null && Array.isArray(value) === false) {
		return value as Record<string, unknown>;
	}
	return undefined;
}
