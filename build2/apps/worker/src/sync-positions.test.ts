import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@moat/db";
import type { Verified } from "@moat/infra";
import { afterEach, describe, expect, it } from "vitest";
import { type MorphoReadClient, positionRowId, syncPositions } from "./sync-positions.js";

const FAKE_BLUE = "0x1111111111111111111111111111111111111111";
const FAKE_WALLET = "0x2222222222222222222222222222222222222222";
const FAKE_LOAN = "0x3333333333333333333333333333333333333333";
const FAKE_COLLATERAL = "0x4444444444444444444444444444444444444444";
const FAKE_ORACLE = "0x5555555555555555555555555555555555555555";
const FAKE_IRM = "0x6666666666666666666666666666666666666666";
const FAKE_MARKET_ID = `0x${"ab".repeat(32)}`;

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db");
const nestedPrisma = join(dbRoot, "node_modules/.bin/prisma");
const prismaBin = existsSync(nestedPrisma) ? nestedPrisma : "prisma";

const NOW = new Date("2026-09-15T00:00:00.000Z");

const FIXTURE = {
	supplyShares: 50000000000000n,
	borrowShares: 31000000000000n,
	collateral: 19000000000000000n,
	totalSupplyAssets: 50000000n,
	totalSupplyShares: 50000000000000n,
	totalBorrowAssets: 31000000n,
	totalBorrowShares: 31000000000000n,
	lastUpdate: 1n,
	fee: 0n,
	lltv: 915000000000000000n,
};

function verifiedFixture(marketId = FAKE_MARKET_ID): Verified {
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
		tokens: {},
		morpho: {
			blue: FAKE_BLUE,
			irm: FAKE_IRM,
			oracleFactory: FAKE_ORACLE,
			markets: [
				{
					id: marketId,
					collateralToken: FAKE_COLLATERAL,
					loanToken: FAKE_LOAN,
					lltv: FIXTURE.lltv.toString(),
					oracle: FAKE_ORACLE,
					irm: FAKE_IRM,
				},
			],
			collateralAccounting: "fixture 1:1 collateral assets",
		},
		oracles: {},
		keeperhub: {
			restBase: "https://app.keeperhub.com",
			mcpUrl: "https://app.keeperhub.com/mcp",
			restEndpointsConfirmed: {},
			mcpOnly: ["validate_workflow"],
			actionTypesConfirmed: [],
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

function mockClient(overrides?: {
	loanToken?: string;
	position?: Partial<typeof FIXTURE>;
}): MorphoReadClient & { calls: string[] } {
	const calls: string[] = [];
	return {
		calls,
		readContract: async ({ functionName, address, args }) => {
			calls.push(functionName);
			expect(address.toLowerCase()).toBe(FAKE_BLUE.toLowerCase());
			if (functionName === "position") {
				expect(args?.[0]).toBe(FAKE_MARKET_ID);
				expect(String(args?.[1]).toLowerCase()).toBe(FAKE_WALLET.toLowerCase());
				return {
					supplyShares: overrides?.position?.supplyShares ?? FIXTURE.supplyShares,
					borrowShares: overrides?.position?.borrowShares ?? FIXTURE.borrowShares,
					collateral: overrides?.position?.collateral ?? FIXTURE.collateral,
				};
			}
			if (functionName === "market") {
				expect(args?.[0]).toBe(FAKE_MARKET_ID);
				return {
					totalSupplyAssets: FIXTURE.totalSupplyAssets,
					totalSupplyShares: FIXTURE.totalSupplyShares,
					totalBorrowAssets: FIXTURE.totalBorrowAssets,
					totalBorrowShares: FIXTURE.totalBorrowShares,
					lastUpdate: FIXTURE.lastUpdate,
					fee: FIXTURE.fee,
				};
			}
			if (functionName === "idToMarketParams") {
				expect(args?.[0]).toBe(FAKE_MARKET_ID);
				return {
					loanToken: overrides?.loanToken ?? FAKE_LOAN,
					collateralToken: FAKE_COLLATERAL,
					oracle: FAKE_ORACLE,
					irm: FAKE_IRM,
					lltv: FIXTURE.lltv,
				};
			}
			throw new Error(`unexpected functionName ${functionName}`);
		},
	};
}

describe("syncPositions", () => {
	let dir = "";
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		await prisma?.$disconnect();
		if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
	});

	async function openDb(): Promise<PrismaClient> {
		dir = mkdtempSync(join(tmpdir(), "moat-sync-"));
		const url = `file:${join(dir, "test.db")}`;
		execFileSync(prismaBin, ["migrate", "deploy"], {
			cwd: dbRoot,
			env: { ...process.env, DATABASE_URL: url },
			encoding: "utf8",
		});
		prisma = new PrismaClient({ datasources: { db: { url } } });
		return prisma;
	}

	it("upserts Market + Position as string bigints and returns MorphoPositionRaw", async () => {
		const db = await openDb();
		const client = mockClient();
		const results = await syncPositions({
			verified: verifiedFixture(),
			prisma: db,
			client,
			now: NOW,
		});

		expect(client.calls.sort()).toEqual(["idToMarketParams", "market", "position"].sort());
		expect(results).toHaveLength(1);
		const row = results[0];
		if (!row) throw new Error("missing result");
		expect(row.raw).toEqual({
			borrowShares: FIXTURE.borrowShares,
			collateralShares: FIXTURE.collateral,
			totalBorrowShares: FIXTURE.totalBorrowShares,
			totalBorrowAssets: FIXTURE.totalBorrowAssets,
			totalSupplyShares: FIXTURE.collateral,
			totalSupplyAssets: FIXTURE.collateral,
		});

		const market = await db.market.findUnique({ where: { id: FAKE_MARKET_ID } });
		expect(market).toEqual({
			id: FAKE_MARKET_ID,
			loanToken: FAKE_LOAN,
			collateralToken: FAKE_COLLATERAL,
			lltv: FIXTURE.lltv.toString(),
			oracle: FAKE_ORACLE,
			irm: FAKE_IRM,
			chainId: "84532",
		});

		const position = await db.position.findUnique({
			where: { id: positionRowId(FAKE_MARKET_ID, FAKE_WALLET) },
		});
		expect(position).toMatchObject({
			marketId: FAKE_MARKET_ID,
			walletAddress: FAKE_WALLET,
			borrowShares: FIXTURE.borrowShares.toString(),
			collateralShares: FIXTURE.collateral.toString(),
			snapshotAt: NOW,
		});
		expect(typeof position?.borrowShares).toBe("string");
		expect(typeof position?.collateralShares).toBe("string");
	});

	it("second sync updates the same Position row", async () => {
		const db = await openDb();
		const first = mockClient();
		await syncPositions({
			verified: verifiedFixture(),
			prisma: db,
			client: first,
			now: NOW,
		});
		const later = new Date("2026-09-15T01:00:00.000Z");
		const second = mockClient({
			position: { borrowShares: 32000000000000n, collateral: 18000000000000000n },
		});
		await syncPositions({
			verified: verifiedFixture(),
			prisma: db,
			client: second,
			now: later,
		});
		expect(await db.position.count()).toBe(1);
		const position = await db.position.findUnique({
			where: { id: positionRowId(FAKE_MARKET_ID, FAKE_WALLET) },
		});
		expect(position?.borrowShares).toBe("32000000000000");
		expect(position?.collateralShares).toBe("18000000000000000");
		expect(position?.snapshotAt).toEqual(later);
	});

	it("throws when onchain market params disagree with verified.json", async () => {
		const db = await openDb();
		await expect(
			syncPositions({
				verified: verifiedFixture(),
				prisma: db,
				client: mockClient({ loanToken: FAKE_COLLATERAL }),
				now: NOW,
			}),
		).rejects.toThrow(/loanToken/);
		expect(await db.market.count()).toBe(0);
		expect(await db.position.count()).toBe(0);
	});
});
