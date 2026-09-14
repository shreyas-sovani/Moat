import type { MorphoPositionRaw } from "./position-risk.js";

const ORACLE_PRICE_SCALE = 10n ** 36n;

export function collateralToLoanUnits(collateralWei: bigint, oraclePrice: bigint): bigint {
	return (collateralWei * oraclePrice) / ORACLE_PRICE_SCALE;
}

export function adjustRawToLoanUnits(
	raw: MorphoPositionRaw,
	oraclePrice: bigint,
): MorphoPositionRaw {
	const collateralLoan = collateralToLoanUnits(raw.collateralShares, oraclePrice);
	const oneToOne = collateralLoan === 0n ? 1n : collateralLoan;
	return {
		...raw,
		collateralShares: collateralLoan,
		totalSupplyShares: oneToOne,
		totalSupplyAssets: oneToOne,
	};
}
