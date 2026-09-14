import { assetsFromShares } from "./morpho-math.js";

export interface MorphoPositionRaw {
	borrowShares: bigint;
	collateralShares: bigint;
	totalBorrowShares: bigint;
	totalBorrowAssets: bigint;
	totalSupplyShares: bigint;
	totalSupplyAssets: bigint;
}

export interface MorphoMarketInfo {
	lltv: bigint;
	loanToken: string;
	collateralToken: string;
	oracle: string;
}

export interface PositionRisk {
	borrowAssets: bigint;
	collateralAssets: bigint;
	ratioOfLltvPct: number;
}

const SCALE = 1_000_000n;

export function computePositionRisk(p: MorphoPositionRaw, m: MorphoMarketInfo): PositionRisk {
	const borrowAssets = assetsFromShares(
		p.borrowShares,
		p.totalBorrowShares,
		p.totalBorrowAssets,
		"up",
	);
	const collateralAssets = assetsFromShares(
		p.collateralShares,
		p.totalSupplyShares,
		p.totalSupplyAssets,
		"down",
	);

	if (p.borrowShares === 0n) {
		return { borrowAssets, collateralAssets, ratioOfLltvPct: 0 };
	}
	if (collateralAssets === 0n) {
		return {
			borrowAssets,
			collateralAssets,
			ratioOfLltvPct: borrowAssets > 0n ? Number.POSITIVE_INFINITY : 0,
		};
	}

	// (borrow / collateral) / (lltv / 1e18) * 100
	// = borrow * 1e18 * 100 / (collateral * lltv)
	const ratioE6 = (borrowAssets * 10n ** 18n * 100n * SCALE) / (collateralAssets * m.lltv);
	return {
		borrowAssets,
		collateralAssets,
		ratioOfLltvPct: Number(ratioE6) / Number(SCALE),
	};
}
