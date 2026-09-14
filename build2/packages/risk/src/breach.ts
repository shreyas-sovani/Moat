export function breachDetected(
	risk: { ratioOfLltvPct: number },
	policy: { triggerRatioPct: number },
): boolean {
	if (Number.isNaN(risk.ratioOfLltvPct) || Number.isNaN(policy.triggerRatioPct)) {
		throw new Error("NaN ratio is not a valid breach input");
	}
	if (risk.ratioOfLltvPct === Number.POSITIVE_INFINITY) {
		return true;
	}
	return risk.ratioOfLltvPct <= policy.triggerRatioPct;
}

export function guardFirePoint(risk: { ratioOfLltvPct: number }, triggerPct: number): number {
	if (Number.isNaN(risk.ratioOfLltvPct) || Number.isNaN(triggerPct)) {
		throw new Error("NaN ratio is not a valid fire-point input");
	}
	if (risk.ratioOfLltvPct >= triggerPct) {
		return 0;
	}
	const raw = (1 - risk.ratioOfLltvPct / triggerPct) * 100;
	const clamped = Math.min(50, Math.max(0, raw));
	return Math.round(clamped * 100) / 100;
}

export function simulateCollateralDrop(
	risk: { ratioOfLltvPct: number },
	dropsPct: number[],
): Array<{ dropPct: number; ratio: number }> {
	return dropsPct.map((dropPct) => {
		if (dropPct < 0 || dropPct >= 50) {
			throw new Error(`dropPct ${dropPct} is outside [0, 50)`);
		}
		return {
			dropPct,
			ratio: risk.ratioOfLltvPct / (1 - dropPct / 100),
		};
	});
}
