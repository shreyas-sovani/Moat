import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./database-url.js";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		datasources: { db: { url: resolveDatabaseUrl(process.env.DATABASE_URL) } },
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}

export { PrismaClient };
