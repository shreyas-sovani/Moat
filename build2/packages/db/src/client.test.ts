import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl } from "./database-url.js";

const prismaDir = join(dirname(fileURLToPath(import.meta.url)), "../prisma");

describe("resolveDatabaseUrl", () => {
	it("puts relative sqlite files next to schema.prisma", () => {
		expect(resolveDatabaseUrl("file:./packages/db/prisma/dev.db")).toBe(
			`file:${join(prismaDir, "dev.db")}`,
		);
		expect(resolveDatabaseUrl("file:./dev.db")).toBe(`file:${join(prismaDir, "dev.db")}`);
	});

	it("keeps absolute sqlite paths", () => {
		expect(resolveDatabaseUrl("file:/tmp/moat.db")).toBe("file:/tmp/moat.db");
	});
});
