import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { seedMinimal } from "./seed.js";

const dbRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const prismaBin = join(dbRoot, "node_modules/.bin/prisma");

describe("seed", () => {
	let dir = "";
	let prisma: PrismaClient | undefined;

	afterEach(async () => {
		await prisma?.$disconnect();
		if (dir.length > 0) rmSync(dir, { recursive: true, force: true });
	});

	it("inserts one row per model and reads them back", async () => {
		dir = mkdtempSync(join(tmpdir(), "moat-db-"));
		const url = `file:${join(dir, "test.db")}`;
		execFileSync(prismaBin, ["migrate", "deploy"], {
			cwd: dbRoot,
			env: { ...process.env, DATABASE_URL: url },
			encoding: "utf8",
		});
		prisma = new PrismaClient({ datasources: { db: { url } } });
		const ids = await seedMinimal(prisma);
		expect(await prisma.user.count()).toBe(1);
		expect(await prisma.wallet.count()).toBe(1);
		expect(await prisma.market.count()).toBe(1);
		expect(await prisma.position.count()).toBe(1);
		expect(await prisma.policy.count()).toBe(1);
		expect(await prisma.plan.count()).toBe(1);
		expect(await prisma.guard.count()).toBe(1);
		expect(await prisma.run.count()).toBe(1);
		expect(await prisma.alert.count()).toBe(1);
		expect(await prisma.heartbeat.count()).toBe(1);
		expect(await prisma.user.findUnique({ where: { id: ids.userId } })).not.toBeNull();
		expect(await prisma.market.findUnique({ where: { id: ids.marketId } })).not.toBeNull();
		expect(await prisma.run.findUnique({ where: { id: ids.runId } })).not.toBeNull();
	});
});
