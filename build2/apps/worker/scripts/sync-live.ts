import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, resolveDatabaseUrl } from "@moat/db";
import { REPO_ROOT, loadEnv, loadVerified } from "@moat/infra";
import { createMorphoViemClient } from "../src/morpho-client.ts";
import { positionRowId, syncPositions } from "../src/sync-positions.ts";

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
const verified = loadVerified();
const now = new Date();
const dbUrl = resolveDatabaseUrl(env.DATABASE_URL);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const EXPECTED = {
	source: "build2/docs/journal/vm1 + CONTEXT.md §5 seed at 2026-09-14T17:34:53Z",
	borrowShares: "31000000000000",
	collateralShares: "19000000000000000",
	supplyShares: "50000000000000",
	totalSupplyAssets: "50000000",
	totalBorrowAssets: "31000000",
};

try {
	const client = createMorphoViemClient({
		rpcUrl: env.RPC_URL_84532,
		chainId: verified.network.chainId,
		chainName: verified.network.name,
	});
	const hits = await syncPositions({ verified, prisma, client, now });
	const hit = hits[0];
	if (!hit) {
		throw new Error("sync returned no positions — verified.json has no markets");
	}
	const position = await prisma.position.findUnique({
		where: { id: positionRowId(hit.marketId, hit.walletAddress) },
	});
	const market = await prisma.market.findUnique({ where: { id: hit.marketId } });
	const comparison = {
		borrowShares: {
			expected: EXPECTED.borrowShares,
			got: position?.borrowShares ?? null,
			match: position?.borrowShares === EXPECTED.borrowShares,
		},
		collateralShares: {
			expected: EXPECTED.collateralShares,
			got: position?.collateralShares ?? null,
			match: position?.collateralShares === EXPECTED.collateralShares,
		},
		supplyShares: {
			expected: EXPECTED.supplyShares,
			got: hit.blue.supplyShares.toString(),
			match: hit.blue.supplyShares.toString() === EXPECTED.supplyShares,
		},
	};
	const allMatch = Object.values(comparison).every((item) => item.match);
	const payload = {
		ok: allMatch,
		asOf: now.toISOString(),
		rpc: env.RPC_URL_84532,
		chainId: verified.network.chainId,
		marketId: hit.marketId,
		walletAddress: hit.walletAddress,
		databaseUrlKind: dbUrl.startsWith("file:") ? "sqlite-file" : "other",
		expected: EXPECTED,
		positionRow: position,
		marketRow: market,
		blue: {
			supplyShares: hit.blue.supplyShares.toString(),
			borrowShares: hit.blue.borrowShares.toString(),
			collateral: hit.blue.collateral.toString(),
			totalSupplyAssets: hit.blue.totalSupplyAssets.toString(),
			totalSupplyShares: hit.blue.totalSupplyShares.toString(),
			totalBorrowAssets: hit.blue.totalBorrowAssets.toString(),
			totalBorrowShares: hit.blue.totalBorrowShares.toString(),
			lastUpdate: hit.blue.lastUpdate.toString(),
			fee: hit.blue.fee.toString(),
		},
		raw: {
			borrowShares: hit.raw.borrowShares.toString(),
			collateralShares: hit.raw.collateralShares.toString(),
			totalBorrowShares: hit.raw.totalBorrowShares.toString(),
			totalBorrowAssets: hit.raw.totalBorrowAssets.toString(),
			totalSupplyShares: hit.raw.totalSupplyShares.toString(),
			totalSupplyAssets: hit.raw.totalSupplyAssets.toString(),
		},
		comparison,
	};
	const journal = join(REPO_ROOT, "docs/journal/3.2");
	mkdirSync(journal, { recursive: true });
	writeFileSync(join(journal, "ac2-live.json"), `${JSON.stringify(payload, null, "\t")}\n`);
	console.log(JSON.stringify({ ok: allMatch, journal: "docs/journal/3.2/ac2-live.json" }));
	if (!allMatch) process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}
