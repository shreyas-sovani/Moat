import { MORPHO_VIEW_ABI } from "@moat/risk";
import { http, type Chain, createPublicClient } from "viem";
import type { MorphoReadClient } from "./sync-positions.js";

export function createMorphoViemClient(input: {
	rpcUrl: string;
	chainId: string;
	chainName: string;
}): MorphoReadClient {
	const chain: Chain = {
		id: Number(input.chainId),
		name: input.chainName,
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: { default: { http: [input.rpcUrl] } },
	};
	const publicClient = createPublicClient({
		chain,
		transport: http(input.rpcUrl),
	});
	return {
		readContract: async ({ address, functionName, args }) => {
			const name = functionName as "position" | "market" | "idToMarketParams";
			return publicClient.readContract({
				address,
				abi: MORPHO_VIEW_ABI,
				functionName: name,
				args: args as never,
			});
		},
	};
}
