import { describe, expect, it } from "vitest";
import { actionAllowed, withinBudget } from "./caps.js";
import { DEFAULT_POLICY, PolicySchema } from "./schema.js";
import { SAFE_MIN_PCT, WARNING_MIN_PCT } from "./zones.js";

describe("PolicySchema", () => {
	it("rejects trigger 99.9 and 140.01, accepts 100 and 140", () => {
		expect(() => PolicySchema.parse({ ...DEFAULT_POLICY, triggerRatioPct: 99.9 })).toThrow();
		expect(() => PolicySchema.parse({ ...DEFAULT_POLICY, triggerRatioPct: 140.01 })).toThrow();
		expect(PolicySchema.parse({ ...DEFAULT_POLICY, triggerRatioPct: 100 }).triggerRatioPct).toBe(
			100,
		);
		expect(PolicySchema.parse({ ...DEFAULT_POLICY, triggerRatioPct: 140 }).triggerRatioPct).toBe(
			140,
		);
	});

	it("rejects empty, duplicate, and unknown allowedActions", () => {
		expect(() => PolicySchema.parse({ ...DEFAULT_POLICY, allowedActions: [] })).toThrow();
		expect(() =>
			PolicySchema.parse({ ...DEFAULT_POLICY, allowedActions: ["top_up", "top_up"] }),
		).toThrow();
		expect(
			PolicySchema.safeParse(
				JSON.parse(
					'{"triggerRatioPct":110,"maxSpendUsd":50,"allowedActions":["liquidate"],"slippageBps":50}',
				),
			).success,
		).toBe(false);
	});

	it("parses defaults", () => {
		expect(DEFAULT_POLICY.circuitBreakerMaxRunsPerDay).toBe(3);
		expect(SAFE_MIN_PCT).toBe(140);
		expect(WARNING_MIN_PCT).toBe(115);
	});
});

describe("caps", () => {
	it("budget boundary == is true and +epsilon is false", () => {
		expect(withinBudget(50, DEFAULT_POLICY)).toBe(true);
		expect(withinBudget(50.0001, DEFAULT_POLICY)).toBe(false);
	});

	it("actionAllowed membership", () => {
		expect(actionAllowed("top_up", DEFAULT_POLICY)).toBe(true);
		expect(actionAllowed("top_up", { ...DEFAULT_POLICY, allowedActions: ["repay"] })).toBe(false);
	});
});
