import { type Verified, loadEnv, loadVerified } from "@moat/infra";
import { assertChainAllowed } from "./chain.js";
import { KhApiError, KhUnsupportedError } from "./errors.js";
import type { GraphJson } from "./graph.js";
import { idempotencyKey } from "./idempotency.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return undefined;
}

export function workflowRows(body: unknown): Array<{ id: string }> {
	let rows: unknown;
	if (Array.isArray(body)) {
		rows = body;
	} else {
		const rec = asRecord(body);
		if (rec && Array.isArray(rec.workflows)) rows = rec.workflows;
		else if (rec && Array.isArray(rec.data)) rows = rec.data;
	}
	if (!Array.isArray(rows)) {
		throw new KhApiError(200, body, "KeeperHub listWorkflows: unexpected JSON shape");
	}
	const out: Array<{ id: string }> = [];
	for (const row of rows) {
		const rec = asRecord(row);
		if (rec && typeof rec.id === "string") {
			out.push({ id: rec.id });
		}
	}
	return out;
}

export interface KhClientOptions {
	fetch?: FetchLike;
	verified?: Verified;
	apiKey?: string;
	sleep?: (ms: number) => Promise<void>;
	allowlist?: string[];
}

interface JsonBody {
	[key: string]: unknown;
}

function isColdStart(body: unknown): body is { code: string; retryAfterSeconds?: number } {
	return (
		typeof body === "object" &&
		body !== null &&
		"code" in body &&
		(body as { code: unknown }).code === "upstream_cold_start"
	);
}

export class KeeperHubClient {
	private readonly fetchImpl: FetchLike;
	private readonly verified: Verified;
	private readonly apiKey: string;
	private readonly sleep: (ms: number) => Promise<void>;
	private readonly allowlist?: string[];

	constructor(opts: KhClientOptions = {}) {
		this.fetchImpl = opts.fetch ?? fetch;
		this.verified = opts.verified ?? loadVerified();
		this.apiKey = opts.apiKey ?? loadEnv().KEEPERHUB_API_KEY;
		this.sleep = opts.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
		this.allowlist = opts.allowlist;
	}

	private path(operation: string): string {
		const mapped = this.verified.keeperhub.restEndpointsConfirmed[operation];
		if (!mapped) {
			if (this.verified.keeperhub.mcpOnly.includes(operation)) {
				throw new KhUnsupportedError(operation);
			}
			throw new KhUnsupportedError(operation);
		}
		return mapped;
	}

	private url(mapped: string, params?: Record<string, string>): string {
		const space = mapped.indexOf(" ");
		let path = space === -1 ? mapped : mapped.slice(space + 1);
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				path = path.replace(`{${key}}`, value);
			}
		}
		return `${this.verified.keeperhub.restBase}${path}`;
	}

	private method(mapped: string): string {
		const space = mapped.indexOf(" ");
		return space === -1 ? "GET" : mapped.slice(0, space);
	}

	private async request(
		operation: string,
		options: {
			params?: Record<string, string>;
			body?: JsonBody;
			idempotency?: string;
			mutating?: boolean;
			chainId?: string;
		} = {},
	): Promise<unknown> {
		if (this.verified.keeperhub.mcpOnly.includes(operation) && operation === "validate_workflow") {
			throw new KhUnsupportedError("validate_workflow");
		}
		if (options.mutating) {
			assertChainAllowed(options.chainId ?? this.verified.network.chainId, this.allowlist);
		}
		const mapped = this.path(operation);
		const url = this.url(mapped, options.params);
		const method = this.method(mapped);
		let lastError: unknown;
		for (let attempt = 1; attempt <= 3; attempt += 1) {
			const headers: Record<string, string> = {
				Authorization: `Bearer ${this.apiKey}`,
				Accept: "application/json",
			};
			if (options.body) headers["Content-Type"] = "application/json";
			if (options.idempotency) {
				headers["Idempotency-Key"] = options.idempotency;
			}
			const payload = options.body
				? {
						...options.body,
						...(options.idempotency ? { idempotency_key: options.idempotency } : {}),
					}
				: undefined;
			let response: Response;
			try {
				response = await this.fetchImpl(url, {
					method,
					headers,
					body: payload ? JSON.stringify(payload) : undefined,
				});
			} catch (err) {
				lastError = err;
				if (attempt === 3) throw err;
				await this.sleep(250 * attempt);
				continue;
			}
			const text = await response.text();
			let body: unknown = text;
			try {
				body = text ? JSON.parse(text) : null;
			} catch {
				body = text;
			}
			if (response.status >= 500 || isColdStart(body)) {
				if (attempt === 3) {
					throw new KhApiError(
						response.status,
						body,
						`KeeperHub ${operation} failed after retries`,
					);
				}
				const waitSec = isColdStart(body) ? (body.retryAfterSeconds ?? 5) : 1;
				await this.sleep(waitSec * 1000);
				continue;
			}
			if (response.status >= 400) {
				throw new KhApiError(
					response.status,
					body,
					`KeeperHub ${operation} HTTP ${response.status}`,
				);
			}
			return body;
		}
		throw lastError instanceof Error ? lastError : new Error("request failed");
	}

	validateWorkflow(_graph: GraphJson): Promise<unknown> {
		return Promise.reject(new KhUnsupportedError("validate_workflow"));
	}

	createWorkflow(graph: GraphJson, key: string, enabled = false): Promise<unknown> {
		return this.request("createWorkflow", {
			mutating: true,
			idempotency: key,
			body: { ...graph, enabled },
		});
	}

	updateWorkflow(id: string, patch: JsonBody): Promise<unknown> {
		return this.request("updateWorkflow", {
			mutating: true,
			params: { workflowId: id },
			body: patch,
		});
	}

	executeWorkflow(id: string, runId: string, input: JsonBody = {}): Promise<unknown> {
		return this.request("executeWorkflow", {
			mutating: true,
			params: { workflowId: id },
			idempotency: idempotencyKey("run", runId),
			body: { input },
		});
	}

	getExecution(executionId: string): Promise<unknown> {
		return this.request("getExecutionStatus", { params: { executionId } });
	}

	getExecutionStatus(executionId: string): Promise<unknown> {
		return this.request("getExecutionStatus", { params: { executionId } });
	}

	getExecutionLogs(executionId: string): Promise<unknown> {
		return this.request("getExecutionLogs", { params: { executionId } });
	}

	directContractCall(body: JsonBody, key: string): Promise<unknown> {
		const chainId = String(body.chainId ?? body.chain_id ?? this.verified.network.chainId);
		return this.request("directContractCall", {
			mutating: true,
			chainId,
			idempotency: key,
			body: { ...body, chainId },
		});
	}

	listWorkflows(): Promise<unknown> {
		return this.request("listWorkflows");
	}

	deleteWorkflow(id: string): Promise<unknown> {
		return this.request("deleteWorkflow", {
			mutating: true,
			params: { workflowId: id },
		});
	}
}
