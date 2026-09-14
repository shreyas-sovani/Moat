import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@moat/db";
import { afterEach, describe, expect, it } from "vitest";
import {
	type GuardKh,
	type GuardLoopContext,
	SUPERVISOR_TIMEOUT_MS,
	superviseRun,
	tickWatcher,
} from "./guard-loop.js";
import type { PositionSyncHit } from "./sync-positions.js";

const FAKE_WALLET = "0x2222222222222222222222222222222222222222";
const FAKE_LOAN = "0x3333333333333333333333333333333333333333";
const FAKE_COLLATERAL = "0x4444444444444444444444444444444444444444";
const FAKE_ORACLE = "0x5555555555555555555555555555555555555555";
const FAKE_IRM = "0x6666666666666666666666666666666666666666";
const FAKE_MARKET_ID = `0x${"ab".repeat(32)}`;
const FAKE_TX = `0x${"cd".repeat(32)}`;

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db");
const nestedPrisma = join(dbRoot, "node_modules/.bin/prisma");
const prismaBin = existsSync(nestedPrisma) ? nestedPrisma : "prisma";

const HIT: PositionSyncHit = {
	marketId: FAKE_MARKET_ID,
	walletAddress: FAKE_WALLET,
	raw: {
		borrowShares: 80n,
		collateralShares: 100n,
		totalBorrowShares: 80n,
		totalBorrowAssets: 80n,
		totalSupplyShares: 100n,
		totalSupplyAssets: 100n,
	},
	blue: {
		supplyShares: 0n,
		borrowShares: 80n,
		collateral: 100n,
		totalSupplyAssets: 80n,
		totalSupplyShares: 80n,
		totalBorrowAssets: 80n,
		totalBorrowShares: 80n,
		lastUpdate: 1n,
		fee: 0n,
	},
};

function fakeClock(start = 0) {
	let t = start;
	return {
		now: () => t,
		sleep: async (ms: number) => {
			t += ms;
		},
	};
}

function breachingAssess() {
	return {
		risk: { ratioOfLltvPct: 80, borrowAssets: 80n, collateralAssets: 100n },
		breach: true,
	};
}

describe("guard loop", () => {
	let dir = "";
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		await prisma?.$disconnect();
		if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
	});

	async function openDb(): Promise<PrismaClient> {
		dir = mkdtempSync(join(tmpdir(), "moat-guard-"));
		const url = `file:${join(dir, "test.db")}`;
		execFileSync(prismaBin, ["migrate", "deploy"], {
			cwd: dbRoot,
			env: { ...process.env, DATABASE_URL: url },
			encoding: "utf8",
		});
		prisma = new PrismaClient({ datasources: { db: { url } } });
		await prisma.$queryRawUnsafe("PRAGMA journal_mode=WAL");
		await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000");
		return prisma;
	}

	async function seedArmed(db: PrismaClient) {
		const user = await db.user.create({ data: { khOrgId: "org" } });
		const market = await db.market.create({
			data: {
				id: FAKE_MARKET_ID,
				loanToken: FAKE_LOAN,
				collateralToken: FAKE_COLLATERAL,
				lltv: "910000000000000000",
				oracle: FAKE_ORACLE,
				irm: FAKE_IRM,
				chainId: "84532",
			},
		});
		const position = await db.position.create({
			data: {
				marketId: market.id,
				walletAddress: FAKE_WALLET,
				borrowShares: "80",
				collateralShares: "100",
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
				planOptions: "[]",
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
		return { userId: user.id, policyId: policy.id, guardId: guard.id, positionId: position.id };
	}

	function mockKh(opts?: {
		execute?: GuardKh["executeWorkflow"];
		statuses?: unknown[];
		execution?: unknown;
		logs?: unknown;
	}): GuardKh & { executeCalls: number } {
		let executeCalls = 0;
		let statusIdx = 0;
		const statuses = opts?.statuses ?? [];
		return {
			get executeCalls() {
				return executeCalls;
			},
			executeWorkflow: async (workflowId, runId) => {
				executeCalls += 1;
				if (opts?.execute) return opts.execute(workflowId, runId);
				return { executionId: `exec-${executeCalls}` };
			},
			getExecutionStatus: async () => {
				const row = statuses[statusIdx];
				if (statusIdx < statuses.length - 1) statusIdx += 1;
				return row ?? { status: "running" };
			},
			getExecution: async () => opts?.execution ?? { transactionHashes: [FAKE_TX] },
			getExecutionLogs: async () => opts?.logs ?? { lines: ["ok"] },
		};
	}

	function ctx(
		db: PrismaClient,
		kh: GuardKh,
		overrides: Partial<GuardLoopContext> = {},
	): GuardLoopContext {
		return {
			prisma: db,
			sync: async () => [HIT],
			kh,
			assess: () => breachingAssess(),
			clock: fakeClock(),
			...overrides,
		};
	}

	it("AC1: two concurrent ticks on one breach create exactly one Run and one executeWorkflow", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		const kh = mockKh({
			execute: async () => {
				await new Promise((resolve) => setTimeout(resolve, 30));
				return { executionId: "exec-race" };
			},
		});
		const loop = ctx(db, kh);
		await Promise.all([tickWatcher(loop), tickWatcher(loop)]);
		expect(await db.run.count()).toBe(1);
		expect(kh.executeCalls).toBe(1);
		const run = await db.run.findFirst();
		expect(run?.guardId).toBe(ids.guardId);
		expect(run?.status).toBe("pending");
		expect(run?.khExecutionId).toBe("exec-race");
		const policy = await db.policy.findUnique({ where: { id: ids.policyId } });
		expect(policy?.status).toBe("firing");
		expect(await db.heartbeat.findUnique({ where: { id: "watcher" } })).not.toBeNull();
	});

	it("AC2: supervisor running→completed persists txHashes, logs, armed policy, alert", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		await db.policy.update({ where: { id: ids.policyId }, data: { status: "firing" } });
		const run = await db.run.create({
			data: {
				guardId: ids.guardId,
				khExecutionId: "exec-ok",
				trigger: "breach",
				status: "pending",
				txHashes: "[]",
				logsJson: "{}",
				beforeSnapshot: JSON.stringify({ ratioOfLltvPct: 80 }),
				afterSnapshot: "{}",
			},
		});
		const alerts: string[] = [];
		const kh = mockKh({
			statuses: [{ status: "running" }, { status: "completed" }],
			execution: { transactionHashes: [FAKE_TX], costUsd: 0.12 },
			logs: { lines: ["guard fired"] },
		});
		await superviseRun(
			ctx(db, kh, {
				notify: async (alert) => {
					alerts.push(alert.level);
				},
			}),
			run.id,
		);
		const done = await db.run.findUnique({ where: { id: run.id } });
		expect(done?.status).toBe("succeeded");
		expect(JSON.parse(done?.txHashes ?? "[]")).toEqual([FAKE_TX]);
		expect(done?.logsJson).toContain("guard fired");
		expect(done?.costUsd).toBe(0.12);
		expect(done?.afterSnapshot.length).toBeGreaterThan(2);
		const policy = await db.policy.findUnique({ where: { id: ids.policyId } });
		expect(policy?.status).toBe("armed");
		expect(await db.alert.count()).toBe(1);
		expect(alerts).toEqual(["info"]);
		expect(await db.heartbeat.findUnique({ where: { id: "supervisor" } })).not.toBeNull();
	});

	it("AC2b: notify-only KH error still succeeds when top-up wrote a tx hash object", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		await db.policy.update({ where: { id: ids.policyId }, data: { status: "firing" } });
		const run = await db.run.create({
			data: {
				guardId: ids.guardId,
				khExecutionId: "exec-notify",
				trigger: "breach",
				status: "pending",
				txHashes: "[]",
				logsJson: "{}",
				beforeSnapshot: JSON.stringify({ ratioOfLltvPct: 99 }),
				afterSnapshot: "{}",
			},
		});
		const payload = {
			status: "error",
			nodeStatuses: [
				{ nodeId: "top-up", status: "success" },
				{ nodeId: "notify-1", status: "error" },
			],
			errorContext: { error: "Telegram bot token is required" },
			transactionHashes: [{ hash: FAKE_TX, nodeId: "top-up", chainId: 84532 }],
		};
		const kh = mockKh({
			statuses: [payload],
			execution: payload,
			logs: payload,
		});
		await superviseRun(ctx(db, kh), run.id);
		const done = await db.run.findUnique({ where: { id: run.id } });
		expect(done?.status).toBe("succeeded");
		expect(JSON.parse(done?.txHashes ?? "[]")).toEqual([FAKE_TX]);
		expect((await db.policy.findUnique({ where: { id: ids.policyId } }))?.status).toBe("armed");
	});

	it("AC3: never-terminal status hits the 15-min cap → failed + alert", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		await db.policy.update({ where: { id: ids.policyId }, data: { status: "firing" } });
		const run = await db.run.create({
			data: {
				guardId: ids.guardId,
				khExecutionId: "exec-hang",
				trigger: "breach",
				status: "pending",
				txHashes: "[]",
				logsJson: "{}",
				beforeSnapshot: "{}",
				afterSnapshot: "{}",
			},
		});
		const alerts: string[] = [];
		const kh = mockKh({ statuses: [{ status: "running" }] });
		await superviseRun(
			ctx(db, kh, {
				clock: fakeClock(),
				supervisorTimeoutMs: SUPERVISOR_TIMEOUT_MS,
				notify: async (alert) => {
					alerts.push(alert.level);
				},
			}),
			run.id,
		);
		const done = await db.run.findUnique({ where: { id: run.id } });
		expect(done?.status).toBe("failed");
		expect(done?.logsJson).toMatch(/timeout/i);
		const policy = await db.policy.findUnique({ where: { id: ids.policyId } });
		expect(policy?.status).toBe("needs_attention");
		expect(alerts).toEqual(["error"]);
		expect(await db.alert.count()).toBe(1);
	});

	it("AC4: failed execution → policy needs_attention + alert", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		await db.policy.update({ where: { id: ids.policyId }, data: { status: "firing" } });
		const run = await db.run.create({
			data: {
				guardId: ids.guardId,
				khExecutionId: "exec-bad",
				trigger: "breach",
				status: "pending",
				txHashes: "[]",
				logsJson: "{}",
				beforeSnapshot: "{}",
				afterSnapshot: "{}",
			},
		});
		const alerts: string[] = [];
		const kh = mockKh({ statuses: [{ status: "failed" }] });
		await superviseRun(
			ctx(db, kh, {
				notify: async (alert) => {
					alerts.push(alert.level);
				},
			}),
			run.id,
		);
		expect((await db.run.findUnique({ where: { id: run.id } }))?.status).toBe("failed");
		expect((await db.policy.findUnique({ where: { id: ids.policyId } }))?.status).toBe(
			"needs_attention",
		);
		expect(alerts).toEqual(["error"]);
		expect(await db.alert.count()).toBe(1);
	});

	it("AC5: after success the policy is armed and the next breach fires again", async () => {
		const db = await openDb();
		await seedArmed(db);
		const kh = mockKh({
			statuses: [{ status: "completed" }],
			execution: { transactionHashes: [FAKE_TX] },
		});
		const loop = ctx(db, kh);
		await tickWatcher(loop);
		const first = await db.run.findFirst();
		if (!first) throw new Error("missing first run");
		await superviseRun(loop, first.id);
		expect((await db.policy.findFirst())?.status).toBe("armed");
		await tickWatcher(loop);
		expect(await db.run.count()).toBe(2);
		expect(kh.executeCalls).toBe(2);
	});

	it("does not fire when policy is not armed", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		await db.policy.update({ where: { id: ids.policyId }, data: { status: "draft" } });
		const kh = mockKh();
		await tickWatcher(ctx(db, kh));
		expect(await db.run.count()).toBe(0);
		expect(kh.executeCalls).toBe(0);
	});

	it("marks the run failed when executeWorkflow throws", async () => {
		const db = await openDb();
		const ids = await seedArmed(db);
		const kh = mockKh({
			execute: async () => {
				throw new Error("kh down");
			},
		});
		await tickWatcher(ctx(db, kh));
		expect(await db.run.count()).toBe(1);
		expect((await db.run.findFirst())?.status).toBe("failed");
		expect((await db.policy.findUnique({ where: { id: ids.policyId } }))?.status).toBe(
			"needs_attention",
		);
		expect(await db.alert.count()).toBe(1);
	});
});
