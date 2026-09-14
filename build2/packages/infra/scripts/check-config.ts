import { loadVerified } from "../src/config.ts";

try {
	const verified = loadVerified();
	if (verified.network.chainId !== "84532" && verified.network.chainId !== "11155111") {
		console.error("chainId not in allowlist", verified.network.chainId);
		process.exit(1);
	}
	console.log(
		JSON.stringify({
			ok: true,
			chainId: verified.network.chainId,
			blue: verified.morpho.blue,
			marketCount: verified.morpho.markets.length,
		}),
	);
} catch (err) {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
}
