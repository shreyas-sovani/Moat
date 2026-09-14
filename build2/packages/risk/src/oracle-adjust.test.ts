import { describe, expect, it } from "vitest";
import { adjustRawToLoanUnits, collateralToLoanUnits } from "./oracle-adjust.js";
import { computePositionRisk } from "./position-risk.js";

describe("collateralToLoanUnits", () => {
	it("reproduces V-M1 seed collateral in USDC raw units", () => {
		const collateralWei = 19000000000000000n;
		const price = 2528352900680000000000000000n;
		expect(collateralToLoanUnits(collateralWei, price)).toBe(48038705n);
	});
});

describe("adjustRawToLoanUnits", () => {
	it("feeds computePositionRisk the 70.526009 live ratio", () => {
		const raw = adjustRawToLoanUnits(
			{
				borrowShares: 31000000n,
				collateralShares: 19000000000000000n,
				totalBorrowShares: 31000000n,
				totalBorrowAssets: 31000000n,
				totalSupplyShares: 19000000000000000n,
				totalSupplyAssets: 19000000000000000n,
			},
			2528352900680000000000000000n,
		);
		const risk = computePositionRisk(raw, {
			lltv: 915000000000000000n,
			loanToken: "loan",
			collateralToken: "coll",
			oracle: "oracle",
		});
		expect(risk.collateralAssets).toBe(48038705n);
		expect(Math.abs(risk.ratioOfLltvPct - 70.526009)).toBeLessThan(1e-6);
	});
});
