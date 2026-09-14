import type { Verified } from "@moat/infra";
import { describe, expect, it } from "vitest";
import { assertChainAllowed } from "./chain.js";
import { KhApiError, KhChainError, KhUnsupportedError } from "./errors.js";
import { idempotencyKey } from "./idempotency.js";
import { KeeperHubClient, workflowRows } from "./rest.js";

const FAKE_ADDR = "0x1111111111111111111111111111111111111111";

function verified(): Verified {
	return {
		network: {
			chainId: "84532",
			name: "base-sepolia",
			rpcUrl: "https://sepolia.base.org",
			explorerUrl: "https://sepolia.basescan.org",
			explorerTxPath: "/tx/{hash}",
			explorerAddressPath: "/address/{address}",
			verifiedBy: "V-N1",
		},
		tokens: {},
		morpho: {
			blue: FAKE_ADDR,
			irm: FAKE_ADDR,
			oracleFactory: FAKE_ADDR,
			markets: [],
			collateralAccounting: "fixture",
		},
		oracles: {},
		keeperhub: {
			restBase: "https://app.keeperhub.com",
			mcpUrl: "https://app.keeperhub.com/mcp",
			restEndpointsConfirmed: {
				createWorkflow: "POST /api/workflows/create",
				executeWorkflow: "POST /api/workflows/{workflowId}/execute",
				getExecutionStatus: "GET /api/workflows/executions/{executionId}/status",
				directContractCall: "POST /api/execute/contract-call",
				listWorkflows: "GET /api/workflows",
			},
			mcpOnly: ["validate_workflow"],
			actionTypesConfirmed: ["web3/check-balance"],
			wallet: {
				integrationId: "int-1",
				address: FAKE_ADDR,
				type: "web3",
				role: "guardian",
			},
		},
		provenance: {},
	};
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("KeeperHubClient retry", () => {
	it("503 then 200 succeeds in exactly 2 attempts", async () => {
		const calls: number[] = [];
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			sleep: async () => undefined,
			fetch: async () => {
				calls.push(1);
				if (calls.length === 1) return jsonResponse(503, { error: "unavailable" });
				return jsonResponse(200, { id: "wf1" });
			},
		});
		const result = await client.createWorkflow(
			{ name: "n", description: "d", nodes: [], edges: [] },
			"moat:plan:1",
		);
		expect(result).toEqual({ id: "wf1" });
		expect(calls.length).toBe(2);
	});

	it("cold_start retries with the same idempotency key", async () => {
		const keys: Array<string | null> = [];
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			sleep: async () => undefined,
			fetch: async (_url, init) => {
				const headers = new Headers(init?.headers);
				keys.push(headers.get("Idempotency-Key"));
				if (keys.length === 1) {
					return jsonResponse(503, { code: "upstream_cold_start", retryAfterSeconds: 2 });
				}
				return jsonResponse(200, { id: "wf1" });
			},
		});
		await client.createWorkflow(
			{ name: "n", description: "d", nodes: [], edges: [] },
			"moat:plan:same",
		);
		expect(keys).toEqual(["moat:plan:same", "moat:plan:same"]);
	});

	it("400 throws KhApiError on attempt 1", async () => {
		let attempts = 0;
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			sleep: async () => undefined,
			fetch: async () => {
				attempts += 1;
				return jsonResponse(400, { error: "invalid_input" });
			},
		});
		await expect(
			client.createWorkflow({ name: "n", description: "d", nodes: [], edges: [] }, "k"),
		).rejects.toBeInstanceOf(KhApiError);
		expect(attempts).toBe(1);
	});
});

describe("chain guard and keys", () => {
	it("assertChainAllowed rejects 8453 and accepts 84532", () => {
		expect(() => assertChainAllowed("8453", ["84532", "11155111"])).toThrow(KhChainError);
		expect(() => assertChainAllowed("84532", ["84532", "11155111"])).not.toThrow();
	});

	it('idempotencyKey("run","r-123") is moat:run:r-123', () => {
		expect(idempotencyKey("run", "r-123")).toBe("moat:run:r-123");
	});

	it("validateWorkflow throws KhUnsupportedError", async () => {
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			fetch: async () => {
				throw new Error("network should not be called");
			},
		});
		await expect(
			client.validateWorkflow({ name: "n", description: "d", nodes: [], edges: [] }),
		).rejects.toBeInstanceOf(KhUnsupportedError);
	});

	it("directContractCall on 8453 throws KhChainError without fetching", async () => {
		let fetched = 0;
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			allowlist: ["84532", "11155111"],
			fetch: async () => {
				fetched += 1;
				return jsonResponse(200, { ok: true });
			},
		});
		await expect(
			client.directContractCall({ chainId: "8453", contractAddress: FAKE_ADDR }, "moat:x:1"),
		).rejects.toBeInstanceOf(KhChainError);
		expect(fetched).toBe(0);
	});

	it("listWorkflows GETs /api/workflows", async () => {
		const calls: Array<{ url: string; method: string }> = [];
		const client = new KeeperHubClient({
			verified: verified(),
			apiKey: "kh_test",
			fetch: async (url, init) => {
				calls.push({ url, method: String(init?.method ?? "GET") });
				return jsonResponse(200, [{ id: "wf1" }]);
			},
		});
		const listed = await client.listWorkflows();
		expect(listed).toEqual([{ id: "wf1" }]);
		expect(calls).toEqual([{ url: "https://app.keeperhub.com/api/workflows", method: "GET" }]);
	});

	it("executeWorkflow sends Idempotency-Key header and does not put it in the JSON body", async () => {
		const calls: Array<{ url: string; method: string; header: string | null; body: unknown }> = [];
		const v = verified();
		v.keeperhub.restEndpointsConfirmed.executeWorkflow = "POST /api/workflows/{workflowId}/execute";
		const client = new KeeperHubClient({
			verified: v,
			apiKey: "kh_test",
			fetch: async (url, init) => {
				const headers = new Headers(init?.headers);
				calls.push({
					url,
					method: String(init?.method ?? "GET"),
					header: headers.get("Idempotency-Key"),
					body: init?.body ? JSON.parse(String(init.body)) : null,
				});
				return jsonResponse(200, { executionId: "exec-1", status: "running" });
			},
		});
		await client.executeWorkflow("wf-1", "run-1");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toBe("https://app.keeperhub.com/api/workflows/wf-1/execute");
		expect(calls[0]?.method).toBe("POST");
		expect(calls[0]?.header).toBe("moat:run:run-1");
		expect(calls[0]?.body).toEqual({ input: {} });
	});

	it("getDirectExecutionStatus GETs /api/execute/{id}/status", async () => {
		const calls: Array<{ url: string; method: string }> = [];
		const v = verified();
		v.keeperhub.restEndpointsConfirmed.directExecutionStatus =
			"GET /api/execute/{executionId}/status";
		const client = new KeeperHubClient({
			verified: v,
			apiKey: "kh_test",
			fetch: async (url, init) => {
				calls.push({ url, method: String(init?.method ?? "GET") });
				return jsonResponse(200, { status: "completed", transactionHash: `0x${"ab".repeat(32)}` });
			},
		});
		const body = await client.getDirectExecutionStatus("exec-1");
		expect(body).toMatchObject({ status: "completed" });
		expect(calls).toEqual([
			{ url: "https://app.keeperhub.com/api/execute/exec-1/status", method: "GET" },
		]);
	});

	it("getSpendCap and listIntegrations hit confirmed REST paths", async () => {
		const calls: string[] = [];
		const v = verified();
		v.keeperhub.restEndpointsConfirmed.spendCap = "GET /api/analytics/spend-cap";
		v.keeperhub.restEndpointsConfirmed.listIntegrations = "GET /api/integrations";
		const client = new KeeperHubClient({
			verified: v,
			apiKey: "kh_test",
			fetch: async (url, init) => {
				calls.push(`${init?.method ?? "GET"} ${url}`);
				return jsonResponse(200, { ok: true });
			},
		});
		await client.getSpendCap();
		await client.listIntegrations();
		expect(calls).toEqual([
			"GET https://app.keeperhub.com/api/analytics/spend-cap",
			"GET https://app.keeperhub.com/api/integrations",
		]);
	});
});

describe("workflowRows", () => {
	it("accepts a bare array", () => {
		expect(workflowRows([{ id: "a" }, { id: "b", name: "n" }])).toEqual([{ id: "a" }, { id: "b" }]);
	});

	it("accepts { workflows: [...] }", () => {
		expect(workflowRows({ workflows: [{ id: "z" }] })).toEqual([{ id: "z" }]);
	});

	it("throws on an unknown list shape", () => {
		expect(() => workflowRows({ ok: true })).toThrow(/listWorkflows/);
	});
});
