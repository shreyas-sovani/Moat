import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/database-url.ts";
import { seedMinimal } from "../src/seed.ts";

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

const here = dirname(fileURLToPath(import.meta.url));
loadDotenv(join(here, "../../../.env"));
loadDotenv(join(here, "../../../../.env"));

const prisma = new PrismaClient({
	datasources: { db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) } },
});
const ids = await seedMinimal(prisma);
await prisma.$disconnect();
console.log(JSON.stringify({ ok: true, ids }));
