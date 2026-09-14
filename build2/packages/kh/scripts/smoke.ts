import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, loadEnv, loadVerified } from "@moat/infra";
import {
	KeeperHubClient,
	KhApiError,
	idempotencyKey,
	validateGraphJson,
	wf,
	workflowRows,
} from "../src/index.ts";

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
	console.error("KEEPERHUB_API_KEY missing — smoke is a live call");
	process.exit(1);
}
if (!env.TELEGRAM_CHAT_ID) {
	console.error("TELEGRAM_CHAT_ID missing — smoke notify cannot use chatId 0");
	process.exit(1);
}

const JOURNAL = join(REPO_ROOT, "docs/journal/kh-smoke");
const REDACT = "[redacted]";

function nextAttemptDir(): string {
	mkdirSync(JOURNAL, { recursive: true });
	for (const name of ["run1", "run2"]) {
		const dir = join(JOURNAL, name);
		if (!existsSync(join(dir, "summary.json"))) return dir;
	}
	return join(JOURNAL, `run-${Date.now()}`);
}

function redactValue(value: unknown, chatId: string): unknown {
	if (typeof value === "string") {
		return value === chatId ? REDACT : value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, chatId));
	}
	if (typeof value === "object" && value !== null) {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value)) {
			if (key === "chatId") {
				out[key] = REDACT;
			} else {
				out[key] = redactValue(item, chatId);
			}
		}
		return out;
	}
	return value;
}

function writeJson(dir: string, name: string, value: unknown, chatId: string): void {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, name), `${JSON.stringify(redactValue(value, chatId), null, "\t")}\n`);
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

function createdId(body: unknown): string | undefined {
	if (typeof body !== "object" || body === null) return undefined;
	const rec = body as Record<string, unknown>;
	if (typeof rec.id === "string") return rec.id;
	if (typeof rec.workflowId === "string") return rec.workflowId;
	if (typeof rec.workflow === "object" && rec.workflow !== null) {
		const inner = rec.workflow as Record<string, unknown>;
		if (typeof inner.id === "string") return inner.id;
	}
	return undefined;
}

function rawWorkflowArray(body: unknown): unknown[] {
	if (Array.isArray(body)) return body;
	if (typeof body !== "object" || body === null) return [];
	const rec = body as Record<string, unknown>;
	if (Array.isArray(rec.workflows)) return rec.workflows;
	if (Array.isArray(rec.data)) return rec.data;
	return [];
}

const verified = loadVerified();
const chatId = env.TELEGRAM_CHAT_ID;
const date = new Date().toISOString().slice(0, 10);
const idem = idempotencyKey("smoke", date);
const attemptDir = nextAttemptDir();

const graph = wf("moat-smoke", "disabled smoke workflow")
	.trigger("Manual")
	.readBalance("read-1", verified.keeperhub.wallet.address)
	.condition("cond-1", {
		left: "{{@read-1:Check Balance.balance}}",
		operator: ">",
		right: "-1",
	})
	.action({
		id: "ok",
		if: "true",
		actionType: "web3/check-balance",
		config: { address: verified.keeperhub.wallet.address },
	})
	.action({
		id: "skip",
		if: "false",
		actionType: "web3/check-balance",
		config: { address: verified.keeperhub.wallet.address },
	})
	.notify("notify-1", chatId, "moat smoke")
	.build();

const validated = validateGraphJson(graph);
writeJson(
	attemptDir,
	"validate.json",
	{ ok: true, local: "validateGraphJson", graph: validated },
	chatId,
);

const client = new KeeperHubClient();
let created: unknown;
try {
	created = await client.createWorkflow(graph, idem, false);
} catch (err) {
	writeJson(
		attemptDir,
		"create-error.json",
		{ ok: false, idempotency: idem, error: errorJournal(err) },
		chatId,
	);
	console.error("createWorkflow failed — see", join(attemptDir, "create-error.json"));
	process.exit(1);
}

writeJson(attemptDir, "create.json", created, chatId);
const id = createdId(created);
if (!id) {
	console.error("create did not return id", created);
	process.exit(1);
}

let listed: unknown;
try {
	listed = await client.listWorkflows();
} catch (err) {
	writeJson(attemptDir, "list-error.json", { ok: false, error: errorJournal(err) }, chatId);
	console.error("listWorkflows failed");
	process.exit(1);
}
const rows = workflowRows(listed);
writeJson(attemptDir, "list-ids.json", { count: rows.length, ids: rows }, chatId);
const createdRow = rawWorkflowArray(listed).find((row) => {
	return typeof row === "object" && row !== null && (row as { id?: unknown }).id === id;
});
writeJson(attemptDir, "list-created.json", createdRow ?? { missing: true, id }, chatId);
const inList = rows.some((row) => row.id === id);

let deleted: unknown;
if (inList) {
	try {
		deleted = await client.deleteWorkflow(id);
	} catch (err) {
		writeJson(attemptDir, "delete-error.json", { ok: false, id, error: errorJournal(err) }, chatId);
		console.error("deleteWorkflow failed");
		process.exit(1);
	}
	writeJson(attemptDir, "delete.json", deleted, chatId);
} else {
	writeJson(
		attemptDir,
		"delete.json",
		{
			skipped: true,
			reason:
				"idempotent replay of deleted workflow; same key returned same id; not in list (no duplicate)",
			id,
		},
		chatId,
	);
}

const summary = {
	ok: true,
	workflowId: id,
	idempotency: idem,
	attempt: attemptDir.startsWith(REPO_ROOT) ? attemptDir.slice(REPO_ROOT.length + 1) : attemptDir,
	listed: inList,
	idempotentReplay: !inList,
};
writeJson(attemptDir, "summary.json", summary, chatId);
console.log(JSON.stringify(summary));
