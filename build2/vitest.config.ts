import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@moat/infra": fileURLToPath(new URL("./packages/infra/src/index.ts", import.meta.url)),
			"@moat/risk": fileURLToPath(new URL("./packages/risk/src/index.ts", import.meta.url)),
			"@moat/policy": fileURLToPath(new URL("./packages/policy/src/index.ts", import.meta.url)),
			"@moat/kh": fileURLToPath(new URL("./packages/kh/src/index.ts", import.meta.url)),
			"@moat/agent": fileURLToPath(new URL("./packages/agent/src/index.ts", import.meta.url)),
			"@moat/db": fileURLToPath(new URL("./packages/db/src/index.ts", import.meta.url)),
		},
	},
	test: {
		include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
		environment: "node",
		testTimeout: 15000,
		passWithNoTests: true,
	},
});
