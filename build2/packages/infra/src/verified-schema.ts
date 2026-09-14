import { z } from "zod";

const ALLOWED_CHAIN_IDS = ["84532", "11155111"] as const;

const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 40-hex EVM address");

const tokenSchema = z.object({
	address: addressSchema,
	decimals: z.number().int().min(0).max(36),
	symbol: z.string().min(1),
	source: z.string().min(1),
});

export const VerifiedSchema = z.object({
	network: z.object({
		chainId: z.enum(ALLOWED_CHAIN_IDS),
		name: z.string().min(1),
		rpcUrl: z.string().url(),
		explorerUrl: z.string().url(),
		explorerTxPath: z.string().min(1),
		explorerAddressPath: z.string().min(1),
		verifiedBy: z.string().min(1),
	}),
	tokens: z.record(z.string(), tokenSchema),
	morpho: z.object({
		blue: addressSchema,
		irm: addressSchema,
		oracleFactory: addressSchema,
		markets: z.array(
			z.object({
				id: z.string().min(1),
				collateralToken: z.string().min(1),
				loanToken: z.string().min(1),
				lltv: z.string().min(1),
				oracle: addressSchema,
				irm: addressSchema,
			}),
		),
		collateralAccounting: z.string().min(1),
	}),
	oracles: z.record(
		z.string(),
		z.object({
			address: addressSchema,
			decimals: z.number().int(),
			description: z.string(),
			source: z.string(),
		}),
	),
	keeperhub: z.object({
		restBase: z.string().url(),
		mcpUrl: z.string().url(),
		restEndpointsConfirmed: z.record(z.string(), z.string()),
		mcpOnly: z.array(z.string()),
		actionTypesConfirmed: z.array(z.string()),
		wallet: z.object({
			integrationId: z.string().min(1),
			address: addressSchema,
			type: z.string().min(1),
			role: z.string().min(1),
		}),
	}),
	provenance: z.record(
		z.string(),
		z.object({
			command: z.string(),
			resultDigest: z.string(),
			timestamp: z.string(),
			branch: z.string().optional(),
		}),
	),
});

export type Verified = z.infer<typeof VerifiedSchema>;
export { ALLOWED_CHAIN_IDS };

export const ActionSchemasFileSchema = z.object({
	fetchedAt: z.string(),
	version: z.string().optional(),
	actions: z.array(
		z.object({
			type: z.string(),
			plugin: z.string(),
			inputSchema: z.unknown(),
			outputSchema: z.unknown(),
		}),
	),
	triggers: z.unknown().optional(),
});

export type ActionSchemasFile = z.infer<typeof ActionSchemasFileSchema>;

export const EnvSchema = z.object({
	KEEPERHUB_API_KEY: z.string().optional().default(""),
	COMPOSER_MODEL: z.string().min(1),
	CRITIC_MODEL: z.string().min(1),
	ANTHROPIC_API_KEY: z.string().optional().default(""),
	DATABASE_URL: z.string().min(1),
	RPC_URL_84532: z.string().url(),
	TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
	TELEGRAM_CHAT_ID: z.string().optional().default(""),
	CHAIN_ALLOWLIST: z.string().min(1),
	VERIFIED_JSON_PATH: z.string().optional(),
	ACTION_SCHEMAS_PATH: z.string().optional(),
	RUN_LIVE_AGENT_TESTS: z.string().optional().default("0"),
	WATCHER_INTERVAL_MS: z.string().optional().default("30000"),
	RECONCILER_INTERVAL_MS: z.string().optional().default("300000"),
});

export type Env = z.infer<typeof EnvSchema>;
