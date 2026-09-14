export class KhGraphError extends Error {
	readonly violations: string[];
	constructor(violations: string[]) {
		super(`KhGraphError: ${violations.join("; ")}`);
		this.name = "KhGraphError";
		this.violations = violations;
	}
}

export class KhApiError extends Error {
	readonly status: number;
	readonly body: unknown;
	constructor(status: number, body: unknown, message: string) {
		super(message);
		this.name = "KhApiError";
		this.status = status;
		this.body = body;
	}
}

export class KhChainError extends Error {
	constructor(chainId: string) {
		super(`KhChainError: chain ${chainId} is not in CHAIN_ALLOWLIST`);
		this.name = "KhChainError";
	}
}

export class KhUnsupportedError extends Error {
	constructor(operation: string) {
		super(`KhUnsupportedError: ${operation} is MCP-only`);
		this.name = "KhUnsupportedError";
	}
}
