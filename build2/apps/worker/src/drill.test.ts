import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@moat/db";
import { type Verified, explorerTxUrl } from "@moat/infra";
import { KhApiError } from "@moat/kh";
import { afterEach, describe, expect, it } from "vitest";
import { buildDefaultTopUpGraph } from "./arm-default-plan.js";
import {
	type DrillKh,
	assessWithOracle,
	buildApproveWethCall,
	buildWithdrawCollateralCall,
	dropPctForTargetRatio,
	parseTxHash,
	reconcileRun,
	shouldReconcile,
	simulateThenBroadcast,
	sizeDrill,
} from "./drill.js";

const FAKE_WALLET = "0x2222222222222222222222222222222222222222";
const FAKE_LOAN = "0x3333333333333333333333333333333333333333";
const FAKE_COLLATERAL = "0x4444444444444444444444444444444444444444";
const FAKE_ORACLE = "0x5555555555555555555555555555555555555555";
const FAKE_IRM = "0x6666666666666666666666666666666666666666";
const FAKE_BLUE = "0x7777777777777777777777777777777777777777";
const FAKE_FACTORY = "0x8888888888888888888888888888888888888888";
const FAKE_MARKET_ID = `0x${"ab".repeat(32)}`;
const FAKE_TX = `0x${"11".repeat(32)}`;
const FAKE_SAVE_TX = `0x${"22".repeat(32)}`;

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db");
const nestedPrisma = join(dbRoot, "node_modules/.bin/prisma");
const prismaBin = existsSync(nestedPrisma) ? nestedPrisma : "prisma";

function fixtureVerified(): Verified {
	return {
		network: {
			chainId: "84532",
			name: "base-sepolia",
			rpcUrl: "https://sepolia.base.org",
			explorerUrl: "https://sepolia.basescan.org",
			explorerTxPath: "/tx/{hash}",
			explorerAddressPath: "/address/{address}",
			verifiedBy: "V-N1",
		},
		tokens: {
			USDC: { address: FAKE_LOAN, decimals: 6, symbol: "USDC", source: "fixture" },
			WETH: { address: FAKE_COLLATERAL, decimals: 18, symbol: "WETH", source: "fixture" },
		},
		morpho: {
			blue: FAKE_BLUE,
			irm: FAKE_IRM,
			oracleFactory: FAKE_FACTORY,
			markets: [
				{
					id: FAKE_MARKET_ID,
					collateralToken: FAKE_COLLATERAL,
					loanToken: FAKE_LOAN,
					lltv: "915000000000000000",
					oracle: FAKE_ORACLE,
					irm: FAKE_IRM,
				},
			],
			collateralAccounting: "fixture",
		},
		oracles: {},
		keeperhub: {
			restBase: "https://app.keeperhub.com",
			mcpUrl: "https://app.keeperhub.com/mcp",
			restEndpointsConfirmed: {},
			mcpOnly: ["validate_workflow"],
			actionTypesConfirmed: ["web3/write-contract"],
			wallet: {
				integrationId: "int-1",
				address: FAKE_WALLET,
				type: "web3",
				role: "guardian",
			},
		},
		provenance: {},
	};
}

describe("dropPctForTargetRatio", () => {
	it("inverts simulateCollateralDrop for r0=80 target=110 → 27.27", () => {
		expect(dropPctForTargetRatio(80, 110)).toBe(27.27);
	});

	it("is 0 when already at or past the target", () => {
		expect(dropPctForTargetRatio(115, 110)).toBe(0);
	});
});

describe("sizeDrill", () => {
	it("caps trigger+5=115 at Morpho-safe 99% of LLTV and sizes a ≥15pt restore", () => {
		const sized = sizeDrill({
			ratioOfLltvPct: 70.526009,
			collateralWei: 19000000000000000n,
			triggerRatioPct: 110,
		});
		expect(sized.requestedTargetRatioPct).toBe(115);
		expect(sized.targetRatioPct).toBe(99);
		expect(sized.withdrawAssets).toBe(5464705343434344n);
		expect(sized.topUpAssets).toBe(sized.withdrawAssets);
		expect(sized.projectedAfterRatioPct).toBeCloseTo(70.526009, 5);
		expect(sized.beforeRatioPct - sized.projectedAfterRatioPct).toBeGreaterThanOrEqual(15);
	});
});

describe("buildWithdrawCollateralCall", () => {
	it("builds a directContractCall body for withdrawCollateral, not morpho/*", () => {
		const call = buildWithdrawCollateralCall({
			verified: fixtureVerified(),
			assets: 5464705343434344n,
		});
		expect(call.chainId).toBe("84532");
		expect(call.contractAddress).toBe(FAKE_BLUE);
		expect(call.functionName).toBe("withdrawCollateral");
		expect(call.simulate).toBeUndefined();
		const args = JSON.parse(String(call.functionArgs)) as unknown[];
		const marketParams = args[0] as Record<string, unknown>;
		expect(marketParams.loanToken).toBe(FAKE_LOAN);
		expect(marketParams.collateralToken).toBe(FAKE_COLLATERAL);
		expect(marketParams.oracle).toBe(FAKE_ORACLE);
		expect(marketParams.irm).toBe(FAKE_IRM);
		expect(marketParams.lltv).toBe("915000000000000000");
		expect(args[1]).toBe("5464705343434344");
		expect(args[2]).toBe(FAKE_WALLET);
		expect(args[3]).toBe(FAKE_WALLET);
		expect(String(call.abi)).toContain("withdrawCollateral");
		expect(String(call.abi)).not.toContain("morpho/withdraw-collateral");
	});
});

describe("buildApproveWethCall", () => {
	it("approves Morpho Blue to pull WETH via web3/write-contract, not morpho/*", () => {
		const call = buildApproveWethCall({
			verified: fixtureVerified(),
			assets: 5817609616161617n,
		});
		expect(call.chainId).toBe("84532");
		expect(call.contractAddress).toBe(FAKE_COLLATERAL);
		expect(call.functionName).toBe("approve");
		const args = JSON.parse(String(call.functionArgs)) as unknown[];
		expect(args[0]).toBe(FAKE_BLUE);
		expect(args[1]).toBe("5817609616161617");
		expect(String(call.abi)).toContain("approve");
	});
});

describe("simulateThenBroadcast", () => {
	it("simulates with boolean true then broadcasts with a different idempotency key", async () => {
		const calls: Array<{ body: Record<string, unknown>; key: string }> = [];
		const kh: DrillKh = {
			directContractCall: async (body, key) => {
				calls.push({ body, key });
				if (body.simulate === true) {
					return { status: "simulated", wouldRevert: false };
				}
				return { status: "completed", transactionHash: FAKE_TX, executionId: "exec-drill" };
			},
		};
		const result = await simulateThenBroadcast({
			kh,
			call: { chainId: "84532", contractAddress: FAKE_BLUE, functionName: "withdrawCollateral" },
			simulateKey: "moat:drill-sim:1",
			broadcastKey: "moat:drill:1",
		});
		expect(calls).toHaveLength(2);
		expect(calls[0]?.body.simulate).toBe(true);
		expect(typeof calls[0]?.body.simulate).toBe("boolean");
		expect(calls[0]?.key).toBe("moat:drill-sim:1");
		expect(calls[1]?.body.simulate).toBeUndefined();
		expect(calls[1]?.key).toBe("moat:drill:1");
		expect(result.transactionHash).toBe(FAKE_TX);
	});

	it("does not broadcast when simulate wouldRevert", async () => {
		let broadcasts = 0;
		const kh: DrillKh = {
			directContractCall: async (body) => {
				if (body.simulate === true) {
					return { status: "simulated", wouldRevert: true };
				}
				broadcasts += 1;
				return { status: "completed", transactionHash: FAKE_TX };
			},
		};
		await expect(
			simulateThenBroadcast({
				kh,
				call: { chainId: "84532", contractAddress: FAKE_BLUE },
				simulateKey: "moat:drill-sim:2",
				broadcastKey: "moat:drill:2",
			}),
		).rejects.toThrow(/wouldRevert/);
		expect(broadcasts).toBe(0);
	});

	it("does not broadcast when simulate throws KhApiError 400", async () => {
		let broadcasts = 0;
		const kh: DrillKh = {
			directContractCall: async (body) => {
				if (body.simulate === true) {
					throw new KhApiError(400, { wouldRevert: true }, "KeeperHub directContractCall HTTP 400");
				}
				broadcasts += 1;
				return { status: "completed", transactionHash: FAKE_TX };
			},
		};
		await expect(
			simulateThenBroadcast({
				kh,
				call: { chainId: "84532", contractAddress: FAKE_BLUE },
				simulateKey: "moat:drill-sim:3",
				broadcastKey: "moat:drill:3",
			}),
		).rejects.toBeInstanceOf(KhApiError);
		expect(broadcasts).toBe(0);
	});

	it("polls direct execution status when broadcast has no hash yet", async () => {
		const kh: DrillKh = {
			directContractCall: async (body) => {
				if (body.simulate === true) return { status: "simulated", wouldRevert: false };
				return { status: "pending", executionId: "exec-pending" };
			},
			getDirectExecutionStatus: async (id) => {
				expect(id).toBe("exec-pending");
				return { status: "completed", transactionHash: FAKE_TX, executionId: id };
			},
		};
		const result = await simulateThenBroadcast({
			kh,
			call: { chainId: "84532", contractAddress: FAKE_BLUE },
			simulateKey: "moat:drill-sim:4",
			broadcastKey: "moat:drill:4",
			sleep: async () => undefined,
		});
		expect(result.transactionHash).toBe(FAKE_TX);
	});
});

describe("shouldReconcile", () => {
	it("passes when the save captures ≥80% of the projected delta", () => {
		expect(shouldReconcile({ beforeRatio: 99, afterRatio: 72, projectedRatio: 70.5 })).toBe(true);
	});

	it("fails when the top-up is skipped and ratio barely moves", () => {
		expect(shouldReconcile({ beforeRatio: 99, afterRatio: 98.5, projectedRatio: 70.5 })).toBe(
			false,
		);
	});
});

describe("parseTxHash and explorer links", () => {
	it("builds explorer URLs from verified.network", () => {
		expect(parseTxHash({ transactionHash: FAKE_TX })).toBe(FAKE_TX);
		expect(explorerTxUrl(fixtureVerified(), FAKE_TX)).toBe(
			`https://sepolia.basescan.org/tx/${FAKE_TX}`,
		);
	});
});

describe("drill top-up graph", () => {
	it("compares WETH balanceRaw to wei so the true branch can fire", () => {
		const graph = buildDefaultTopUpGraph({
			verified: fixtureVerified(),
			chatId: "test-chat",
			topUpAssets: "5464705343434344",
			balanceField: "balance.balanceRaw",
		});
		const cond = graph.nodes.find((n) => n.data.config.actionType === "Condition");
		expect(String(cond?.data.config.condition)).toContain("balance.balanceRaw");
		expect(String(cond?.data.config.condition)).toContain("5464705343434344");
		const topUp = graph.nodes.find((n) => n.data.config.actionType === "web3/write-contract");
		expect(topUp?.data.config.abiFunction).toBe("supplyCollateral");
		expect(graph.nodes.some((n) => String(n.data.config.actionType).startsWith("morpho/"))).toBe(
			false,
		);
	});
});

describe("reconcileRun", () => {
	let dir = "";
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		await prisma?.$disconnect();
		if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
	});

	async function openDb(): Promise<PrismaClient> {
		dir = mkdtempSync(join(tmpdir(), "moat-drill-"));
		const url = `file:${join(dir, "test.db")}`;
		execFileSync(prismaBin, ["migrate", "deploy"], {
			cwd: dbRoot,
			env: { ...process.env, DATABASE_URL: url },
			encoding: "utf8",
		});
		prisma = new PrismaClient({ datasources: { db: { url } } });
		return prisma;
	}

	async function seedRun(
		db: PrismaClient,
		ratios: { before: number; after: number; projected: number },
	) {
		const user = await db.user.create({ data: { khOrgId: "org" } });
		const market = await db.market.create({
			data: {
				id: FAKE_MARKET_ID,
				loanToken: FAKE_LOAN,
				collateralToken: FAKE_COLLATERAL,
				lltv: "915000000000000000",
				oracle: FAKE_ORACLE,
				irm: FAKE_IRM,
				chainId: "84532",
			},
		});
		const position = await db.position.create({
			data: {
				marketId: market.id,
				walletAddress: FAKE_WALLET,
				borrowShares: "31000000000000",
				collateralShares: "19000000000000000",
				snapshotAt: new Date("2026-09-15T00:00:00.000Z"),
			},
		});
		const policy = await db.policy.create({
			data: {
				positionId: position.id,
				triggerRatioPct: 110,
				maxSpendUsd: 50,
				allowedActions: "top_up",
				slippageBps: 50,
				status: "armed",
				circuitBreakerMaxRunsPerDay: 3,
			},
		});
		const plan = await db.plan.create({
			data: {
				policyId: policy.id,
				workflowJson: "{}",
				rationale: "seed",
				planOptions: JSON.stringify([{ kind: "top_up", projectedRatioPct: ratios.projected }]),
				criticVerdict: "{}",
				simulateResult: "{}",
				status: "approved",
			},
		});
		const guard = await db.guard.create({
			data: {
				policyId: policy.id,
				planId: plan.id,
				khWorkflowId: "wf-guard",
				khIdempotencyKey: "moat:plan:seed",
				status: "armed",
			},
		});
		const run = await db.run.create({
			data: {
				guardId: guard.id,
				khExecutionId: "exec-ok",
				trigger: "breach",
				status: "succeeded",
				txHashes: JSON.stringify([FAKE_SAVE_TX]),
				logsJson: JSON.stringify({ lines: ["ok"] }),
				beforeSnapshot: JSON.stringify({ ratioOfLltvPct: ratios.before }),
				afterSnapshot: JSON.stringify({ ratioOfLltvPct: ratios.after }),
			},
		});
		return { userId: user.id, runId: run.id, planId: plan.id };
	}

	it("sets reconciledAt when after captures ≥80% of the projected delta", async () => {
		const db = await openDb();
		const ids = await seedRun(db, { before: 99, after: 72, projected: 70.5 });
		const at = new Date("2026-09-15T01:00:00.000Z");
		const ok = await reconcileRun(db, ids.runId, at);
		expect(ok).toBe(true);
		const run = await db.run.findUnique({ where: { id: ids.runId } });
		expect(run?.reconciledAt?.toISOString()).toBe(at.toISOString());
	});

	it("leaves reconciledAt null when the save did not improve enough", async () => {
		const db = await openDb();
		const ids = await seedRun(db, { before: 99, after: 98.5, projected: 70.5 });
		expect(await reconcileRun(db, ids.runId)).toBe(false);
		const run = await db.run.findUnique({ where: { id: ids.runId } });
		expect(run?.reconciledAt).toBeNull();
	});
});

describe("assessWithOracle", () => {
	it("oracle-adjusts Morpho collateral before computing risk", () => {
		const result = assessWithOracle(
			{
				marketId: FAKE_MARKET_ID,
				walletAddress: FAKE_WALLET,
				raw: {
					borrowShares: 31000000n,
					collateralShares: 19000000000000000n,
					totalBorrowShares: 31000000n,
					totalBorrowAssets: 31000000n,
					totalSupplyShares: 19000000000000000n,
					totalSupplyAssets: 19000000000000000n,
				},
				blue: {
					supplyShares: 0n,
					borrowShares: 31000000n,
					collateral: 19000000000000000n,
					totalSupplyAssets: 50000000n,
					totalSupplyShares: 50000000000000n,
					totalBorrowAssets: 31000000n,
					totalBorrowShares: 31000000n,
					lastUpdate: 1n,
					fee: 0n,
				},
			},
			{
				lltv: "915000000000000000",
				loanToken: FAKE_LOAN,
				collateralToken: FAKE_COLLATERAL,
				oracle: FAKE_ORACLE,
			},
			2528352900680000000000000000n,
			110,
		);
		expect(Math.abs(result.risk.ratioOfLltvPct - 70.526009)).toBeLessThan(1e-6);
		expect(result.breach).toBe(true);
	});
});
