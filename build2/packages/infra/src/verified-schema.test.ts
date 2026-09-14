import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadVerified } from "./config.js";
import { VerifiedSchema } from "./verified-schema.js";

const FAKE_ADDR = "0x1111111111111111111111111111111111111111";

function validFixture() {
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
		tokens: {
			USDC: {
				address: FAKE_ADDR,
				decimals: 6,
				symbol: "USDC",
				source: "fixture",
			},
		},
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
			restEndpointsConfirmed: { listWorkflows: "GET /api/workflows" },
			mcpOnly: ["validate_workflow"],
			actionTypesConfirmed: ["web3/check-balance"],
			wallet: {
				integrationId: "int-1",
				address: FAKE_ADDR,
				type: "web3",
				role: "guardian",
			},
		},
		provenance: {
			"V-N1": {
				command: "cast block-number",
				resultDigest: "ok",
				timestamp: "2026-09-14T00:00:00Z",
			},
		},
	};
}

describe("VerifiedSchema", () => {
	it("parses a full valid fixture", () => {
		const parsed = VerifiedSchema.parse(validFixture());
		expect(parsed.network.chainId).toBe("84532");
	});

	it("rejects chainId 8453 (Base mainnet)", () => {
		const clone = validFixture();
		clone.network.chainId = "8453";
		expect(() => VerifiedSchema.parse(clone)).toThrow();
	});

	it("rejects chainId 1 (Ethereum mainnet)", () => {
		const clone = validFixture();
		clone.network.chainId = "1";
		expect(() => VerifiedSchema.parse(clone)).toThrow();
	});
});

describe("loadVerified", () => {
	it("throws an Error whose message contains the Zod issue path when morpho.blue is missing", () => {
		const dir = mkdtempSync(join(tmpdir(), "moat-verified-"));
		const path = join(dir, "verified.json");
		const clone = validFixture() as Record<string, unknown>;
		const morpho = { ...(clone.morpho as Record<string, unknown>) };
		morpho.blue = undefined;
		clone.morpho = morpho;
		writeFileSync(path, JSON.stringify(clone));
		expect(() => loadVerified(path)).toThrow(/morpho\.blue/);
	});
});
