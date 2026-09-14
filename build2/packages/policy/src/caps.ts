import type { AllowedAction, Policy } from "./schema.js";

export function withinBudget(costUsd: number, policy: Policy): boolean {
	return costUsd <= policy.maxSpendUsd;
}

export function actionAllowed(action: AllowedAction, policy: Policy): boolean {
	return policy.allowedActions.includes(action);
}
