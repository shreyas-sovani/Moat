import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMoatEnv } from "./load-env.ts";

loadMoatEnv();

const here = dirname(fileURLToPath(import.meta.url));
const nestedBin = join(here, "../node_modules/.bin/prisma");
const prismaBin = existsSync(nestedBin) ? nestedBin : "prisma";
const args = process.argv.slice(2);
if (args.length === 0) {
	console.error("usage: tsx scripts/run-prisma.ts <prisma args>");
	process.exit(1);
}

execFileSync(prismaBin, args, {
	stdio: "inherit",
	env: process.env,
	cwd: join(here, ".."),
});
