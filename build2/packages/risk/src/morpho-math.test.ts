import { describe, expect, it } from "vitest";
import { assetsFromShares } from "./morpho-math.js";

describe("assetsFromShares", () => {
	it.each([
		[100n, 100n, 100n, "down" as const, 100n],
		// Backlog row listed 150/100/300→50, which is shares*totalShares/totalAssets.
		// Contract formula is shares*totalAssets/totalShares, so the 50-result vector is 150/300/100.
		[150n, 300n, 100n, "down" as const, 50n],
		[1n, 3n, 1n, "up" as const, 1n],
		[2n, 3n, 1n, "up" as const, 1n],
		[4n, 3n, 1n, "up" as const, 2n],
		[0n, 100n, 100n, "up" as const, 0n],
		[7n, 3n, 10n, "down" as const, 23n],
		[7n, 3n, 10n, "up" as const, 24n],
	])("table %s / %s of %s %s = %s", (shares, totalShares, totalAssets, dir, result) => {
		expect(assetsFromShares(shares, totalShares, totalAssets, dir)).toBe(result);
	});

	it("property: up is always >= down and differs by at most 1 for 50 random triples", () => {
		let seed = 123456789n;
		const next = (): bigint => {
			seed = (seed * 6364136223846793005n + 1n) & ((1n << 64n) - 1n);
			return (seed % 10_000n) + 1n;
		};
		for (let i = 0; i < 50; i += 1) {
			const shares = next();
			const totalShares = next();
			const totalAssets = next();
			const down = assetsFromShares(shares, totalShares, totalAssets, "down");
			const up = assetsFromShares(shares, totalShares, totalAssets, "up");
			expect(up >= down).toBe(true);
			expect(up - down <= 1n).toBe(true);
		}
	});
});
