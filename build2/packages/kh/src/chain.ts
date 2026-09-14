import { CHAIN_ALLOWLIST, loadActionSchemas, loadVerified } from "@moat/infra";
import { KhChainError } from "./errors.js";

export function assertChainAllowed(chainId: string, allowlist = CHAIN_ALLOWLIST): void {
	if (!allowlist.includes(chainId)) {
		throw new KhChainError(chainId);
	}
}

export function verifiedChainId(): string {
	return loadVerified().network.chainId;
}

export function actionTypeSet(): Set<string> {
	return new Set(loadActionSchemas().actions.map((action) => action.type));
}
