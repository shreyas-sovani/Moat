import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "../src/database-url.ts";
import { seedMinimal } from "../src/seed.ts";
import { loadMoatEnv } from "./load-env.ts";

loadMoatEnv();

const prisma = new PrismaClient({
	datasources: { db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) } },
});
const ids = await seedMinimal(prisma);
await prisma.$disconnect();
console.log(JSON.stringify({ ok: true, ids }));
