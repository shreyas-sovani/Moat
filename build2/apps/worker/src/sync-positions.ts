import type { PrismaClient } from "@moat/db";
import type { Verified } from "@moat/infra";
import { MORPHO_VIEW_ABI, type MorphoPositionRaw } from "@moat/risk";

export interface MorphoReadClient {
	readContract(args: {
		address: `0x${string}`;
		abi?: unknown;
		functionName: string;
		args?: readonly unknown[];
	}): Promise<unknown>;
}

export interface PositionSyncHit {
	marketId: string;
	walletAddress: string;
	raw: MorphoPositionRaw;
	blue: {
		supplyShares: bigint;
		borrowShares: bigint;
		collateral: bigint;
		totalSupplyAssets: bigint;
		totalSupplyShares: bigint;
		totalBorrowAssets: bigint;
		totalBorrowShares: bigint;
		lastUpdate: bigint;
		fee: bigint;
	};
}

export class MarketParamsMismatchError extends Error {
	constructor(field: string, marketId: string) {
		super(`onchain ${field} does not match verified.json for market ${marketId}`);
		this.name = "MarketParamsMismatchError";
	}
}

export function positionRowId(marketId: string, walletAddress: string): string {
	return `${marketId.toLowerCase()}:${walletAddress.toLowerCase()}`;
}

export async function syncPositions(input: {
	verified: Verified;
	prisma: PrismaClient;
	client: MorphoReadClient;
	now?: Date;
}): Promise<PositionSyncHit[]> {
	const now = input.now ?? new Date();
	const wallet = input.verified.keeperhub.wallet.address;
	const hits: PositionSyncHit[] = [];
	for (const market of input.verified.morpho.markets) {
		hits.push(
			await syncOne({
				verified: input.verified,
				prisma: input.prisma,
				client: input.client,
				now,
				wallet,
				market,
			}),
		);
	}
	return hits;
}

async function syncOne(input: {
	verified: Verified;
	prisma: PrismaClient;
	client: MorphoReadClient;
	now: Date;
	wallet: string;
	market: Verified["morpho"]["markets"][number];
}): Promise<PositionSyncHit> {
	const blue = as0x(input.verified.morpho.blue);
	const marketId = as0x(input.market.id);
	const user = as0x(input.wallet);
	const [positionRaw, marketRaw, paramsRaw] = await Promise.all([
		input.client.readContract({
			address: blue,
			abi: MORPHO_VIEW_ABI,
			functionName: "position",
			args: [marketId, user],
		}),
		input.client.readContract({
			address: blue,
			abi: MORPHO_VIEW_ABI,
			functionName: "market",
			args: [marketId],
		}),
		input.client.readContract({
			address: blue,
			abi: MORPHO_VIEW_ABI,
			functionName: "idToMarketParams",
			args: [marketId],
		}),
	]);

	const position = parsePosition(positionRaw);
	const marketState = parseMarket(marketRaw);
	const params = parseMarketParams(paramsRaw);
	assertParamsMatch(input.market, params);

	await input.prisma.market.upsert({
		where: { id: input.market.id },
		create: {
			id: input.market.id,
			loanToken: params.loanToken,
			collateralToken: params.collateralToken,
			lltv: params.lltv.toString(),
			oracle: params.oracle,
			irm: params.irm,
			chainId: input.verified.network.chainId,
		},
		update: {
			loanToken: params.loanToken,
			collateralToken: params.collateralToken,
			lltv: params.lltv.toString(),
			oracle: params.oracle,
			irm: params.irm,
			chainId: input.verified.network.chainId,
		},
	});

	const rowId = positionRowId(input.market.id, input.wallet);
	const borrowShares = position.borrowShares.toString();
	const collateralShares = position.collateral.toString();
	await input.prisma.position.upsert({
		where: { id: rowId },
		create: {
			id: rowId,
			marketId: input.market.id,
			walletAddress: input.wallet,
			borrowShares,
			collateralShares,
			snapshotAt: input.now,
		},
		update: {
			borrowShares,
			collateralShares,
			snapshotAt: input.now,
		},
	});

	return {
		marketId: input.market.id,
		walletAddress: input.wallet,
		raw: {
			borrowShares: position.borrowShares,
			collateralShares: position.collateral,
			totalBorrowShares: marketState.totalBorrowShares,
			totalBorrowAssets: marketState.totalBorrowAssets,
			totalSupplyShares: position.collateral,
			totalSupplyAssets: position.collateral,
		},
		blue: {
			supplyShares: position.supplyShares,
			borrowShares: position.borrowShares,
			collateral: position.collateral,
			...marketState,
		},
	};
}

function assertParamsMatch(
	expected: Verified["morpho"]["markets"][number],
	actual: {
		loanToken: string;
		collateralToken: string;
		oracle: string;
		irm: string;
		lltv: bigint;
	},
): void {
	if (!sameHex(expected.loanToken, actual.loanToken)) {
		throw new MarketParamsMismatchError("loanToken", expected.id);
	}
	if (!sameHex(expected.collateralToken, actual.collateralToken)) {
		throw new MarketParamsMismatchError("collateralToken", expected.id);
	}
	if (!sameHex(expected.oracle, actual.oracle)) {
		throw new MarketParamsMismatchError("oracle", expected.id);
	}
	if (!sameHex(expected.irm, actual.irm)) {
		throw new MarketParamsMismatchError("irm", expected.id);
	}
	if (expected.lltv !== actual.lltv.toString()) {
		throw new MarketParamsMismatchError("lltv", expected.id);
	}
}

function parsePosition(value: unknown): {
	supplyShares: bigint;
	borrowShares: bigint;
	collateral: bigint;
} {
	if (Array.isArray(value)) {
		return {
			supplyShares: asBigint(value[0], "supplyShares"),
			borrowShares: asBigint(value[1], "borrowShares"),
			collateral: asBigint(value[2], "collateral"),
		};
	}
	const rec = asRecord(value, "position");
	return {
		supplyShares: asBigint(rec.supplyShares, "supplyShares"),
		borrowShares: asBigint(rec.borrowShares, "borrowShares"),
		collateral: asBigint(rec.collateral, "collateral"),
	};
}

function parseMarket(value: unknown): {
	totalSupplyAssets: bigint;
	totalSupplyShares: bigint;
	totalBorrowAssets: bigint;
	totalBorrowShares: bigint;
	lastUpdate: bigint;
	fee: bigint;
} {
	if (Array.isArray(value)) {
		return {
			totalSupplyAssets: asBigint(value[0], "totalSupplyAssets"),
			totalSupplyShares: asBigint(value[1], "totalSupplyShares"),
			totalBorrowAssets: asBigint(value[2], "totalBorrowAssets"),
			totalBorrowShares: asBigint(value[3], "totalBorrowShares"),
			lastUpdate: asBigint(value[4], "lastUpdate"),
			fee: asBigint(value[5], "fee"),
		};
	}
	const rec = asRecord(value, "market");
	return {
		totalSupplyAssets: asBigint(rec.totalSupplyAssets, "totalSupplyAssets"),
		totalSupplyShares: asBigint(rec.totalSupplyShares, "totalSupplyShares"),
		totalBorrowAssets: asBigint(rec.totalBorrowAssets, "totalBorrowAssets"),
		totalBorrowShares: asBigint(rec.totalBorrowShares, "totalBorrowShares"),
		lastUpdate: asBigint(rec.lastUpdate, "lastUpdate"),
		fee: asBigint(rec.fee, "fee"),
	};
}

function parseMarketParams(value: unknown): {
	loanToken: string;
	collateralToken: string;
	oracle: string;
	irm: string;
	lltv: bigint;
} {
	if (Array.isArray(value)) {
		return {
			loanToken: asAddress(value[0], "loanToken"),
			collateralToken: asAddress(value[1], "collateralToken"),
			oracle: asAddress(value[2], "oracle"),
			irm: asAddress(value[3], "irm"),
			lltv: asBigint(value[4], "lltv"),
		};
	}
	const rec = asRecord(value, "idToMarketParams");
	return {
		loanToken: asAddress(rec.loanToken, "loanToken"),
		collateralToken: asAddress(rec.collateralToken, "collateralToken"),
		oracle: asAddress(rec.oracle, "oracle"),
		irm: asAddress(rec.irm, "irm"),
		lltv: asBigint(rec.lltv, "lltv"),
	};
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`${label}: expected named viem result`);
	}
	return value as Record<string, unknown>;
}

function asBigint(value: unknown, label: string): bigint {
	if (typeof value === "bigint") return value;
	if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
	if (typeof value === "string" && value.length > 0) return BigInt(value);
	throw new Error(`${label}: expected bigint`);
}

function asAddress(value: unknown, label: string): string {
	if (typeof value !== "string" || !value.startsWith("0x") || value.length < 3) {
		throw new Error(`${label}: expected 0x address`);
	}
	return value;
}

function as0x(value: string): `0x${string}` {
	if (!value.startsWith("0x")) {
		throw new Error("expected 0x-prefixed hex");
	}
	return value as `0x${string}`;
}

function sameHex(a: string, b: string): boolean {
	return a.toLowerCase() === b.toLowerCase();
}
