import { writeFileSync } from "node:fs";
import { actionSchemasPath, loadEnv } from "../src/config.ts";

const env = loadEnv();
const base = env.KEEPERHUB_API_KEY ? "https://app.keeperhub.com" : "";
if (!env.KEEPERHUB_API_KEY) {
	console.error("KEEPERHUB_API_KEY is required for schema sync");
	process.exit(1);
}

const res = await fetch("https://app.keeperhub.com/api/mcp/schemas", {
	headers: { Authorization: `Bearer ${env.KEEPERHUB_API_KEY}` },
});
if (!res.ok) {
	console.error(`schema fetch failed: ${res.status}`);
	process.exit(1);
}
const dump = (await res.json()) as {
	generatedAt?: string;
	version?: string;
	actions: Record<
		string,
		{
			actionType?: string;
			requiredFields?: unknown;
			optionalFields?: unknown;
			outputFields?: unknown;
		}
	>;
	triggers?: unknown;
};

const actions = Object.entries(dump.actions).map(([key, value]) => ({
	type: value.actionType ?? key,
	plugin: key.includes("/") ? key.split("/")[0] : "system",
	inputSchema: {
		requiredFields: value.requiredFields ?? {},
		optionalFields: value.optionalFields ?? {},
	},
	outputSchema: value.outputFields ?? {},
}));

const out = {
	fetchedAt: dump.generatedAt ?? new Date().toISOString(),
	version: dump.version,
	actions,
	triggers: dump.triggers,
};

writeFileSync(actionSchemasPath(), `${JSON.stringify(out)}\n`);
console.log(`wrote ${actions.length} actions fetchedAt=${out.fetchedAt}`);
