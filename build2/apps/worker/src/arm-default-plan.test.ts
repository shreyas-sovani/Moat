import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@moat/db";
import type { Verified } from "@moat/infra";
import type { GraphJson } from "@moat/kh";
import { afterEach, describe, expect, it } from "vitest";
import { type ArmKh, armDefaultPlan } from "./arm-default-plan.js";
import { positionRowId } from "./sync-positions.js";

const FAKE_WALLET = "0x2222222222222222222222222222222222222222";
const FAKE_LOAN = "0x3333333333333333333333333333333333333333";
const FAKE_COLLATERAL = "0x4444444444444444444444444444444444444444";
const FAKE_ORACLE = "0x5555555555555555555555555555555555555555";
const FAKE_IRM = "0x6666666666666666666666666666666666666666";
const FAKE_BLUE = "0x7777777777777777777777777777777777777777";
const FAKE_FACTORY = "0x8888888888888888888888888888888888888888";
const FAKE_MARKET_ID = `0x${"ab".repeat(32)}`;
const CHAT_ID = "test-chat";
const PLAN_UUID = "plan-test-1";

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
			USDC: {
				address: FAKE_LOAN,
				decimals: 6,
				symbol: "USDC",
				source: "fixture",
			},
			WETH: {
				address: FAKE_COLLATERAL,
				decimals: 18,
				symbol: "WETH",
				source: "fixture",
			},
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
			actionTypesConfirmed: ["morpho/supply-collateral"],
			wallet: {
				integrationId: "int-1",
				address: FAKE_WALLET,
				type: "web3",
				role: "guardian",
				balances: {
					eth: "0.061",
					usdc: "31",
					weth: "0",
					asOf: "2026-09-14T17:34:53Z",
				},
			},
		},
		provenance: {},
	};
}

describe("armDefaultPlan", () => {
	let dir = "";
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		await prisma?.$disconnect();
		if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
	});

	async function openDb(): Promise<PrismaClient> {
		dir = mkdtempSync(join(tmpdir(), "moat-arm-"));
		const url = `file:${join(dir, "test.db")}`;
		execFileSync(prismaBin, ["migrate", "deploy"], {
			cwd: dbRoot,
			env: { ...process.env, DATABASE_URL: url },
			encoding: "utf8",
		});
		prisma = new PrismaClient({ datasources: { db: { url } } });
		return prisma;
	}

	function mockKh(): ArmKh & {
		createCalls: Array<{ graph: GraphJson; key: string; enabled: boolean }>;
		listCalls: number;
		updateCalls: Array<{ id: string; patch: Record<string, unknown> }>;
		validateCalls: number;
	} {
		const createCalls: Array<{ graph: GraphJson; key: string; enabled: boolean }> = [];
		const updateCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];
		return {
			createCalls,
			updateCalls,
			listCalls: 0,
			validateCalls: 0,
			createWorkflow: async (graph, key, enabled = false) => {
				createCalls.push({ graph, key, enabled: enabled === true });
				return { id: "wf-default-1", enabled: true };
			},
			listWorkflows: async () => {
				return [{ id: "wf-default-1", enabled: true }];
			},
			updateWorkflow: async (id, patch) => {
				updateCalls.push({ id, patch });
				return { id, ...patch };
			},
		};
	}

	it("AC1/AC2: creates enabled KH workflow and one armed Guard linked to policy+plan", async () => {
		const db = await openDb();
		const kh = mockKh();
		kh.listWorkflows = async () => {
			kh.listCalls += 1;
			return [{ id: "wf-default-1", enabled: true }];
		};
		const result = await armDefaultPlan({
			prisma: db,
			verified: fixtureVerified(),
			kh,
			chatId: CHAT_ID,
			uuid: () => PLAN_UUID,
		});

		expect(result.workflowId).toBe("wf-default-1");
		expect(result.enabled).toBe(true);
		expect(kh.createCalls).toHaveLength(1);
		expect(kh.createCalls[0]?.enabled).toBe(true);
		expect(kh.createCalls[0]?.key).toBe("moat:plan:plan-test-1");
		expect(kh.validateCalls).toBe(0);

		const graph = kh.createCalls[0]?.graph;
		if (!graph) throw new Error("expected graph");
		expect(graph.name).toBe("moat-default-top-up");
		const trigger = graph.nodes.find((n) => n.type === "trigger");
		expect(trigger?.data.config.triggerType).toBe("Manual");
		expect(graph.nodes.some((n) => n.data.config.actionType === "morpho/supply-collateral")).toBe(
			false,
		);
		const topUp = graph.nodes.find((n) => n.data.config.actionType === "web3/write-contract");
		if (!topUp) throw new Error("expected web3/write-contract top-up");
		expect(topUp.data.config.abiFunction).toBe("supplyCollateral");
		expect(topUp.data.config.contractAddress).toBe(FAKE_BLUE);
		expect(topUp.data.config.network).toBe("84532");
		const argsRaw = topUp.data.config.functionArgs;
		expect(typeof argsRaw).toBe("string");
		const args = JSON.parse(String(argsRaw)) as unknown[];
		const marketParams = args[0] as Record<string, unknown>;
		expect(marketParams.loanToken).toBe(FAKE_LOAN);
		expect(marketParams.collateralToken).toBe(FAKE_COLLATERAL);
		expect(marketParams.oracle).toBe(FAKE_ORACLE);
		expect(marketParams.irm).toBe(FAKE_IRM);
		expect(marketParams.lltv).toBe("915000000000000000");
		expect(args[1]).toBe("1000000000000000");
		expect(args[2]).toBe(FAKE_WALLET);
		expect(args[3]).toBe("0x");
		const cond = graph.nodes.find((n) => n.data.config.actionType === "Condition");
		expect(cond?.type).toBe("action");
		const condEdges = graph.edges.filter((e) => e.source === cond?.id);
		expect(condEdges.some((e) => e.sourceHandle === "true")).toBe(true);
		expect(condEdges.some((e) => e.sourceHandle === "false")).toBe(true);
		const notify = graph.nodes.find((n) => n.data.config.actionType === "telegram/send-message");
		expect(notify?.data.config.chatId).toBe(CHAT_ID);
		expect(notify?.data.config.chatId).not.toBe("0");

		const guards = await db.guard.findMany();
		expect(guards).toHaveLength(1);
		const guard = guards[0];
		if (!guard) throw new Error("expected guard");
		expect(guard.status).toBe("armed");
		expect(guard.khWorkflowId).toBe("wf-default-1");
		expect(guard.khIdempotencyKey).toBe("moat:plan:plan-test-1");
		expect(guard.policyId).toBe(result.policyId);
		expect(guard.planId).toBe(result.planId);

		const policy = await db.policy.findUnique({ where: { id: guard.policyId } });
		expect(policy?.triggerRatioPct).toBe(110);
		expect(policy?.maxSpendUsd).toBe(31);
		expect(policy?.status).toBe("armed");

		const position = await db.position.findUnique({
			where: { id: positionRowId(FAKE_MARKET_ID, FAKE_WALLET) },
		});
		expect(position?.walletAddress.toLowerCase()).toBe(FAKE_WALLET.toLowerCase());
		expect(kh.listCalls).toBeGreaterThanOrEqual(1);
	});

	it("AC3: rerun does not create a second Guard or a second createWorkflow", async () => {
		const db = await openDb();
		const kh = mockKh();
		const input = {
			prisma: db,
			verified: fixtureVerified(),
			kh,
			chatId: CHAT_ID,
			uuid: () => PLAN_UUID,
		};
		const first = await armDefaultPlan(input);
		const second = await armDefaultPlan(input);
		expect(second.guardId).toBe(first.guardId);
		expect(second.workflowId).toBe(first.workflowId);
		expect(second.created).toBe(false);
		expect(kh.createCalls).toHaveLength(1);
		expect(await db.guard.count()).toBe(1);
	});

	it("re-enables an existing KH workflow instead of inserting another Guard", async () => {
		const db = await openDb();
		const kh = mockKh();
		kh.listWorkflows = async () => {
			kh.listCalls += 1;
			return [{ id: "wf-default-1", enabled: false }];
		};
		const first = await armDefaultPlan({
			prisma: db,
			verified: fixtureVerified(),
			kh,
			chatId: CHAT_ID,
			uuid: () => PLAN_UUID,
		});
		expect(first.enabled).toBe(true);
		expect(kh.updateCalls.some((c) => c.id === "wf-default-1" && c.patch.enabled === true)).toBe(
			true,
		);
		expect(await db.guard.count()).toBe(1);
	});
});
