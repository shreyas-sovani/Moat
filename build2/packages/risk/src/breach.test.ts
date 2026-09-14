import { describe, expect, it } from "vitest";
import { breachDetected, guardFirePoint, simulateCollateralDrop } from "./breach.js";

describe("breachDetected", () => {
	it("fires on exact equality and not just above", () => {
		expect(breachDetected({ ratioOfLltvPct: 110 }, { triggerRatioPct: 110 })).toBe(true);
		expect(breachDetected({ ratioOfLltvPct: 110.01 }, { triggerRatioPct: 110 })).toBe(false);
	});

	it("Infinity fires and NaN throws", () => {
		expect(
			breachDetected({ ratioOfLltvPct: Number.POSITIVE_INFINITY }, { triggerRatioPct: 110 }),
		).toBe(true);
		expect(() => breachDetected({ ratioOfLltvPct: Number.NaN }, { triggerRatioPct: 110 })).toThrow(
			/NaN/,
		);
	});
});

describe("guardFirePoint", () => {
	it("r0=80 trigger=110 is 27.27", () => {
		expect(guardFirePoint({ ratioOfLltvPct: 80 }, 110)).toBe(27.27);
	});

	it("clamps already-at-or-past trigger to 0 and large drops to 50", () => {
		// Formula d=(1-r0/trigger)*100; r0>=trigger → 0. r0=105,trigger=110 → 4.55
		// (backlog wrote 105→0, which contradicts the 80→27.27 formula; formula wins)
		expect(guardFirePoint({ ratioOfLltvPct: 110 }, 110)).toBe(0);
		expect(guardFirePoint({ ratioOfLltvPct: 115 }, 110)).toBe(0);
		expect(guardFirePoint({ ratioOfLltvPct: 105 }, 110)).toBe(4.55);
		expect(guardFirePoint({ ratioOfLltvPct: 10 }, 110)).toBe(50);
	});
});

describe("simulateCollateralDrop", () => {
	it("is strictly increasing across [0,10,20,30,40,49]", () => {
		const rows = simulateCollateralDrop({ ratioOfLltvPct: 80 }, [0, 10, 20, 30, 40, 49]);
		for (let i = 1; i < rows.length; i += 1) {
			const prev = rows[i - 1];
			const cur = rows[i];
			if (!prev || !cur) throw new Error("missing row");
			expect(cur.ratio).toBeGreaterThan(prev.ratio);
		}
	});

	it("throws for d=50 and d=-1", () => {
		expect(() => simulateCollateralDrop({ ratioOfLltvPct: 80 }, [50])).toThrow();
		expect(() => simulateCollateralDrop({ ratioOfLltvPct: 80 }, [-1])).toThrow();
	});
});
