import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, resolveDatabaseUrl } from "@moat/db";
import { REPO_ROOT, loadEnv, loadVerified } from "@moat/infra";
import { KeeperHubClient, KhApiError } from "@moat/kh";
import { armDefaultPlan } from "../src/arm-default-plan.ts";

function loadDotenv(path: string): void {
	if (!existsSync(path)) return;
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		const line = raw.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 1) continue;
		const key = line.slice(0, eq);
		let value = line.slice(eq + 1);
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadDotenv(join(REPO_ROOT, ".env"));
loadDotenv(join(REPO_ROOT, "../.env"));

const env = loadEnv();
if (!env.KEEPERHUB_API_KEY) {
	console.error("KEEPERHUB_API_KEY missing — 3.4 is a live KeeperHub create");
	process.exit(1);
}
if (!env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID === "0") {
	console.error("TELEGRAM_CHAT_ID missing — notify cannot use chatId 0");
	process.exit(1);
}

const JOURNAL = join(REPO_ROOT, "docs/journal/3.4");
const REDACT = "[redacted]";
const chatId = env.TELEGRAM_CHAT_ID;

function redactValue(value: unknown, secret: string): unknown {
	if (typeof value === "string") {
		if (secret.length === 0) return value;
		if (value === secret) return REDACT;
		if (value.includes(secret)) return value.split(secret).join(REDACT);
		return value;
	}
	if (value instanceof Date) return value.toISOString();
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, secret));
	}
	if (typeof value === "object" && value !== null) {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			if (key === "chatId") out[key] = REDACT;
			else out[key] = redactValue(item, secret);
		}
		return out;
	}
	return value;
}

function writeJson(name: string, value: unknown): void {
	mkdirSync(JOURNAL, { recursive: true });
	writeFileSync(join(JOURNAL, name), `${JSON.stringify(redactValue(value, chatId), null, "\t")}\n`);
}

function errorJournal(err: unknown): Record<string, unknown> {
	if (err instanceof KhApiError) {
		return { name: err.name, message: err.message, status: err.status, body: err.body };
	}
	if (err instanceof Error) {
		return { name: err.name, message: err.message };
	}
	return { error: String(err) };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value === "object" && value !== null && Array.isArray(value) === false) {
		return value as Record<string, unknown>;
	}
	return undefined;
}

function workflowRecords(body: unknown): Record<string, unknown>[] {
	let rows: unknown;
	if (Array.isArray(body)) rows = body;
	else {
		const rec = asRecord(body);
		if (rec && Array.isArray(rec.workflows)) rows = rec.workflows;
		else if (rec && Array.isArray(rec.data)) rows = rec.data;
		else rows = [];
	}
	if (!Array.isArray(rows)) return [];
	const out: Record<string, unknown>[] = [];
	for (const row of rows) {
		const rec = asRecord(row);
		if (rec && typeof rec.id === "string") out.push(rec);
	}
	return out;
}

function parseEnabled(row: Record<string, unknown> | undefined): boolean {
	if (!row) return false;
	if (typeof row.enabled === "boolean") return row.enabled;
	if (typeof row.isEnabled === "boolean") return row.isEnabled;
	return false;
}

const verified = loadVerified();
const dbUrl = resolveDatabaseUrl(env.DATABASE_URL);
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
const kh = new KeeperHubClient();

try {
	const first = await armDefaultPlan({
		prisma,
		verified,
		kh,
		chatId,
	});
	writeJson("validate.json", { ok: true, local: "validateGraphJson", graph: first.graph });
	writeJson("ac1-first.json", {
		created: first.created,
		workflowId: first.workflowId,
		enabled: first.enabled,
		idempotencyKey: first.idempotencyKey,
		guardId: first.guardId,
		planId: first.planId,
		policyId: first.policyId,
	});
	writeJson("ac1-list.json", first.listed);
	const listedRow =
		workflowRecords(first.listed).find((row) => row.id === first.workflowId) ??
		({ missing: true, id: first.workflowId } as Record<string, unknown>);
	writeJson("ac1-list-created.json", listedRow);
	const listEnabled = parseEnabled("missing" in listedRow ? undefined : listedRow);

	const guard = await prisma.guard.findUnique({ where: { id: first.guardId } });
	const policy = await prisma.policy.findUnique({ where: { id: first.policyId } });
	const plan = await prisma.plan.findUnique({ where: { id: first.planId } });
	writeJson("ac2-guard.json", { guard, policy, plan });

	const second = await armDefaultPlan({
		prisma,
		verified,
		kh,
		chatId,
	});
	const guardCount = await prisma.guard.count();
	writeJson("ac3-rerun.json", {
		firstGuardId: first.guardId,
		secondGuardId: second.guardId,
		sameGuard: first.guardId === second.guardId,
		secondCreated: second.created,
		guardCount,
	});

	const ok =
		first.enabled === true &&
		listEnabled === true &&
		guard?.status === "armed" &&
		guard.khWorkflowId === first.workflowId &&
		guard.policyId === first.policyId &&
		guard.planId === first.planId &&
		policy?.triggerRatioPct === 110 &&
		second.created === false &&
		first.guardId === second.guardId &&
		guardCount === 1;

	const summary = {
		ok,
		workflowId: first.workflowId,
		listEnabled,
		guardStatus: guard?.status ?? null,
		guardCount,
		databaseUrlKind: dbUrl.startsWith("file:") ? "sqlite-file" : "other",
	};
	writeJson("summary.json", summary);
	console.log(JSON.stringify(summary));
	if (!ok) process.exitCode = 1;
} catch (err) {
	writeJson("error.json", { ok: false, error: errorJournal(err) });
	console.error("arm-default-plan failed — see docs/journal/3.4/error.json");
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}
