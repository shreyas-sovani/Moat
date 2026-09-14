export type RoundDirection = "up" | "down";

export function assetsFromShares(
	shares: bigint,
	totalShares: bigint,
	totalAssets: bigint,
	direction: RoundDirection,
): bigint {
	if (shares === 0n || totalShares === 0n) {
		return 0n;
	}
	const product = shares * totalAssets;
	const floor = product / totalShares;
	if (direction === "down") {
		return floor;
	}
	const remainder = product % totalShares;
	if (remainder === 0n) {
		return floor;
	}
	return floor + 1n;
}
