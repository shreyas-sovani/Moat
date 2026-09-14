import { z } from "zod";

export const ALLOWED_ACTIONS = ["top_up", "repay", "withdraw_repay"] as const;
export type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

export const PolicySchema = z.object({
	triggerRatioPct: z.number().min(100).max(140),
	maxSpendUsd: z.number().positive(),
	allowedActions: z
		.array(z.enum(ALLOWED_ACTIONS))
		.min(1)
		.refine((actions) => new Set(actions).size === actions.length, {
			message: "allowedActions must not contain duplicates",
		}),
	slippageBps: z.union([z.literal(10), z.literal(50), z.literal(100)]),
	circuitBreakerMaxRunsPerDay: z.number().int().min(1).max(10).default(3),
});

export type Policy = z.infer<typeof PolicySchema>;

export const DEFAULT_POLICY: Policy = PolicySchema.parse({
	triggerRatioPct: 110,
	maxSpendUsd: 50,
	allowedActions: ["top_up", "repay", "withdraw_repay"],
	slippageBps: 50,
	circuitBreakerMaxRunsPerDay: 3,
});
