import type { Verified } from "@moat/infra";
import { describe, expect, it } from "vitest";
import { assertChainAllowed } from "./chain.js";
import { KhApiError, KhChainError } from "./errors.js";
import { idempotencyKey } from "./idempotency.js";
import { KeeperHubClient } from "./rest.js";

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
});
