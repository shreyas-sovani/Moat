import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	type ActionSchemasFile,
	ActionSchemasFileSchema,
	type Env,
	EnvSchema,
	type Verified,
	VerifiedSchema,
} from "./verified-schema.js";

function findRepoRoot(startDir: string): string {
	let dir = startDir;
	for (let i = 0; i < 12; i += 1) {
		if (existsSync(join(dir, "pnpm-workspace.yaml")) && existsSync(join(dir, "config"))) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return process.cwd();
}

function resolveRepoPath(fromEnv: string | undefined, fallbackRelative: string): string {
	if (fromEnv && fromEnv.length > 0) {
		return isAbsolute(fromEnv) ? fromEnv : resolve(REPO_ROOT, fromEnv);
	}
	return join(REPO_ROOT, fallbackRelative);
}

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(here);

export function verifiedJsonPath(): string {
	return resolveRepoPath(process.env.VERIFIED_JSON_PATH, join("config", "verified.json"));
}

export function actionSchemasPath(): string {
	return resolveRepoPath(process.env.ACTION_SCHEMAS_PATH, join("config", "action-schemas.json"));
}

export function loadVerified(path = verifiedJsonPath()): Verified {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to read verified.json at ${path}: ${message}`);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`verified.json at ${path} is not valid JSON: ${message}`);
	}
	const result = VerifiedSchema.safeParse(parsed);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Invalid verified.json at ${path}: ${issues}`);
	}
	return result.data;
}

export function loadActionSchemas(path = actionSchemasPath()): ActionSchemasFile {
	const raw = readFileSync(path, "utf8");
	const parsed: unknown = JSON.parse(raw);
	return ActionSchemasFileSchema.parse(parsed);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const result = EnvSchema.safeParse({
		KEEPERHUB_API_KEY: source.KEEPERHUB_API_KEY ?? "",
		COMPOSER_MODEL: source.COMPOSER_MODEL ?? "gemini-2.5-flash",
		CRITIC_MODEL: source.CRITIC_MODEL ?? "gemini-2.5-flash-lite",
		GEMINI_API_KEY: source.GEMINI_API_KEY ?? "",
		ANTHROPIC_API_KEY: source.ANTHROPIC_API_KEY ?? "",
		DATABASE_URL: source.DATABASE_URL ?? "file:./packages/db/prisma/dev.db",
		RPC_URL_84532: source.RPC_URL_84532 ?? "https://sepolia.base.org",
		TELEGRAM_BOT_TOKEN: source.TELEGRAM_BOT_TOKEN ?? "",
		TELEGRAM_CHAT_ID: source.TELEGRAM_CHAT_ID ?? "",
		CHAIN_ALLOWLIST: source.CHAIN_ALLOWLIST ?? "84532,11155111",
		VERIFIED_JSON_PATH: source.VERIFIED_JSON_PATH,
		ACTION_SCHEMAS_PATH: source.ACTION_SCHEMAS_PATH,
		RUN_LIVE_AGENT_TESTS: source.RUN_LIVE_AGENT_TESTS ?? "0",
		WATCHER_INTERVAL_MS: source.WATCHER_INTERVAL_MS ?? "30000",
		RECONCILER_INTERVAL_MS: source.RECONCILER_INTERVAL_MS ?? "300000",
	});
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
			.join("; ");
		throw new Error(`Invalid environment: ${issues}`);
	}
	return result.data;
}

export function parseChainAllowlist(raw: string): string[] {
	return raw
		.split(",")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

export const CHAIN_ALLOWLIST: string[] = parseChainAllowlist(
	process.env.CHAIN_ALLOWLIST ?? "84532,11155111",
);

export function explorerTxUrl(verified: Verified, txHash: string): string {
	const path = verified.network.explorerTxPath.replace("{hash}", txHash);
	return `${verified.network.explorerUrl}${path}`;
}

export function explorerAddressUrl(verified: Verified, address: string): string {
	const path = verified.network.explorerAddressPath.replace("{address}", address);
	return `${verified.network.explorerUrl}${path}`;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export { REPO_ROOT };
