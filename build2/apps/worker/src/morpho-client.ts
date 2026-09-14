import { MORPHO_ORACLE_PRICE_ABI, MORPHO_VIEW_ABI } from "@moat/risk";
import { http, type Chain, createPublicClient } from "viem";
import type { MorphoReadClient } from "./sync-positions.js";

function publicClient(input: { rpcUrl: string; chainId: string; chainName: string }) {
	const chain: Chain = {
		id: Number(input.chainId),
		name: input.chainName,
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
		rpcUrls: { default: { http: [input.rpcUrl] } },
	};
	return createPublicClient({
		chain,
		transport: http(input.rpcUrl),
	});
}

export function createMorphoViemClient(input: {
	rpcUrl: string;
	chainId: string;
	chainName: string;
}): MorphoReadClient {
	const client = publicClient(input);
	return {
		readContract: async ({ address, functionName, args }) => {
			const name = functionName as "position" | "market" | "idToMarketParams";
			return client.readContract({
				address,
				abi: MORPHO_VIEW_ABI,
				functionName: name,
				args: args as never,
			});
		},
	};
}

export async function readMorphoOraclePrice(input: {
	rpcUrl: string;
	chainId: string;
	chainName: string;
	oracle: `0x${string}`;
}): Promise<bigint> {
	const client = publicClient(input);
	return client.readContract({
		address: input.oracle,
		abi: MORPHO_ORACLE_PRICE_ABI,
		functionName: "price",
	});
}
