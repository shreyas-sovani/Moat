import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@moat/risk",
		"@moat/policy",
		"@moat/kh",
		"@moat/agent",
		"@moat/db",
		"@moat/infra",
	],
};

export default nextConfig;
