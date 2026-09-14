import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function loadDotenv(path: string): void {
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

const here = dirname(fileURLToPath(import.meta.url));

export function loadMoatEnv(): void {
	loadDotenv(join(here, "../../../.env"));
	loadDotenv(join(here, "../../../../.env"));
	if (!process.env.DATABASE_URL) {
		process.env.DATABASE_URL = "file:./dev.db";
	}
}
