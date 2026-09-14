import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const prismaDir = join(dirname(fileURLToPath(import.meta.url)), "../prisma");

export function resolveDatabaseUrl(raw: string | undefined): string {
	const url = raw && raw.length > 0 ? raw : "file:./dev.db";
	if (!url.startsWith("file:")) return url;
	const rest = url.slice("file:".length);
	if (isAbsolute(rest)) return `file:${rest}`;
	const parts = rest.split("/").filter((part) => part.length > 0 && part !== ".");
	const basename = parts[parts.length - 1] ?? "dev.db";
	return `file:${join(prismaDir, basename)}`;
}

export { prismaDir };
