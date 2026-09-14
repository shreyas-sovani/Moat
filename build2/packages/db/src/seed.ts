import type { PrismaClient } from "@prisma/client";

export interface SeedIds {
	userId: string;
	walletId: string;
	marketId: string;
	positionId: string;
	policyId: string;
	planId: string;
	guardId: string;
	runId: string;
	alertId: string;
	heartbeatId: string;
}

export async function seedMinimal(prisma: PrismaClient): Promise<SeedIds> {
	const user = await prisma.user.create({
		data: { khOrgId: "seed-org" },
	});
	const wallet = await prisma.wallet.create({
		data: { userId: user.id, address: "seed-wallet", role: "guardian" },
	});
	const market = await prisma.market.create({
		data: {
			id: "seed-market",
			loanToken: "seed-loan",
			collateralToken: "seed-collateral",
			lltv: "0",
			oracle: "seed-oracle",
			irm: "seed-irm",
			chainId: "seed-chain",
		},
	});
	const position = await prisma.position.create({
		data: {
			marketId: market.id,
			walletAddress: wallet.address,
			borrowShares: "0",
			collateralShares: "0",
			snapshotAt: new Date("2026-09-14T00:00:00.000Z"),
		},
	});
	const policy = await prisma.policy.create({
		data: {
			positionId: position.id,
			triggerRatioPct: 110,
			maxSpendUsd: 1,
			allowedActions: "top_up",
			slippageBps: 50,
			status: "draft",
			circuitBreakerMaxRunsPerDay: 3,
		},
	});
	const plan = await prisma.plan.create({
		data: {
			policyId: policy.id,
			workflowJson: "{}",
			rationale: "seed",
			planOptions: "[]",
			criticVerdict: "{}",
			simulateResult: "{}",
			status: "proposed",
		},
	});
	const guard = await prisma.guard.create({
		data: {
			policyId: policy.id,
			planId: plan.id,
			khWorkflowId: "seed-workflow",
			khIdempotencyKey: "moat:seed:1",
			status: "disabled",
		},
	});
	const run = await prisma.run.create({
		data: {
			guardId: guard.id,
			khExecutionId: "seed-execution",
			trigger: "manual",
			status: "pending",
			txHashes: "[]",
			logsJson: "{}",
			beforeSnapshot: "{}",
			afterSnapshot: "{}",
		},
	});
	const alert = await prisma.alert.create({
		data: {
			runId: run.id,
			level: "info",
			channel: "journal",
			payload: "{}",
		},
	});
	const heartbeat = await prisma.heartbeat.create({
		data: {
			component: "watcher",
			lastTickAt: new Date("2026-09-14T00:00:00.000Z"),
			detail: "{}",
		},
	});
	return {
		userId: user.id,
		walletId: wallet.id,
		marketId: market.id,
		positionId: position.id,
		policyId: policy.id,
		planId: plan.id,
		guardId: guard.id,
		runId: run.id,
		alertId: alert.id,
		heartbeatId: heartbeat.id,
	};
}
