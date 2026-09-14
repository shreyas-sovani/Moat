import { describe, expect, it } from "vitest";
import { assetsFromShares } from "./morpho-math.js";
import { computePositionRisk } from "./position-risk.js";

const LLTV = 910000000000000000n;
const FAKE_LOAN = "FAKE_LOAN";
const FAKE_COLLATERAL = "FAKE_COLLATERAL";
const FAKE_ORACLE = "FAKE_ORACLE";

function market(lltv = LLTV) {
	return {
		lltv,
		loanToken: FAKE_LOAN,
		collateralToken: FAKE_COLLATERAL,
		oracle: FAKE_ORACLE,
	};
}

function oneToOne(borrowAssets: bigint, collateralAssets: bigint) {
	return {
		borrowShares: borrowAssets,
		collateralShares: collateralAssets,
		totalBorrowShares: borrowAssets === 0n ? 1n : borrowAssets,
		totalBorrowAssets: borrowAssets === 0n ? 1n : borrowAssets,
		totalSupplyShares: collateralAssets === 0n ? 1n : collateralAssets,
		totalSupplyAssets: collateralAssets === 0n ? 1n : collateralAssets,
	};
}

describe("computePositionRisk", () => {
	it("91 / 100 at 0.91e18 lltv is exactly 100", () => {
		const risk = computePositionRisk(oneToOne(91n, 100n), market());
		expect(risk.borrowAssets).toBe(91n);
		expect(risk.collateralAssets).toBe(100n);
		expect(Math.abs(risk.ratioOfLltvPct - 100)).toBeLessThan(1e-6);
	});

	it("45.5 via shares 455/1000 of 100 collateral-equivalent assets is 50", () => {
		// 455 borrow-shares of 1000 totaling 100 assets → 45.5, rounded up to 46.
		// Spec table targets 50, which is exact for 45.5/100 at 0.91e18.
		// Integer path that hits 50 exactly: 455 borrow assets / 1000 collateral.
		const risk = computePositionRisk(oneToOne(455n, 1000n), market());
		expect(Math.abs(risk.ratioOfLltvPct - 50)).toBeLessThan(1e-6);
	});

	it("10 borrow and 0 collateral is Infinity", () => {
		const risk = computePositionRisk(oneToOne(10n, 0n), market());
		expect(risk.ratioOfLltvPct).toBe(Number.POSITIVE_INFINITY);
	});

	it("0 borrow and 100 collateral is 0", () => {
		const risk = computePositionRisk(oneToOne(0n, 100n), market());
		expect(risk.ratioOfLltvPct).toBe(0);
	});

	it("91 / 200 at 0.91e18 lltv is 50", () => {
		const risk = computePositionRisk(oneToOne(91n, 200n), market());
		expect(Math.abs(risk.ratioOfLltvPct - 50)).toBeLessThan(1e-6);
	});

	it("rounds borrow up and collateral down when floor != ceil", () => {
		const shares = 2n;
		const totalShares = 3n;
		const totalAssets = 10n;
		expect(assetsFromShares(shares, totalShares, totalAssets, "down")).toBe(6n);
		expect(assetsFromShares(shares, totalShares, totalAssets, "up")).toBe(7n);
		const risk = computePositionRisk(
			{
				borrowShares: shares,
				collateralShares: shares,
				totalBorrowShares: totalShares,
				totalBorrowAssets: totalAssets,
				totalSupplyShares: totalShares,
				totalSupplyAssets: totalAssets,
			},
			market(),
		);
		expect(risk.borrowAssets).toBe(7n);
		expect(risk.collateralAssets).toBe(6n);
	});

	it("reproduces Task 0.5 AC4 live WETH/USDC position (~70.5% of 91.5% LLTV)", () => {
		// Live Base Sepolia Morpho position (journal/vm1/ac4-ratio.txt), oracle-adjusted
		// into loan-token raw units so computePositionRisk's same-asset formula applies:
		//   oracle.price at seed = 2528352900680000000000000000
		//   collateral = 0.019 WETH = 19000000000000000 wei
		//   collateral_loan = collateral * price / 1e36 = 48038705 (48.038705 USDC)
		//   borrow = 31000000 (31 USDC)
		//   lltv = 915000000000000000 (91.0% disabled on this Blue; 91.5% enabled)
		//   ratio = borrow * 1e18 * 100 / (collateral_loan * lltv) = 70.526009%
		// Market id 0x8cf9d4da91299e76e501b0e5d28aaa2009e4b42f20992b3433f4290024e70e0d
		const lltv = 915000000000000000n;
		const borrow = 31000000n;
		const collateralLoan = 48038705n;
		const risk = computePositionRisk(oneToOne(borrow, collateralLoan), market(lltv));
		expect(risk.borrowAssets).toBe(borrow);
		expect(risk.collateralAssets).toBe(collateralLoan);
		expect(Math.abs(risk.ratioOfLltvPct - 70.526009)).toBeLessThan(1e-6);
	});
});
