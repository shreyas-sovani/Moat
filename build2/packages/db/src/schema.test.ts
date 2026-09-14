import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

describe("prisma schema", () => {
	it("exposes ten models matching PRD §4.2", () => {
		const client = new PrismaClient();
		expect(typeof client.user.create).toBe("function");
		expect(typeof client.wallet.create).toBe("function");
		expect(typeof client.market.create).toBe("function");
		expect(typeof client.position.create).toBe("function");
		expect(typeof client.policy.create).toBe("function");
		expect(typeof client.plan.create).toBe("function");
		expect(typeof client.guard.create).toBe("function");
		expect(typeof client.run.create).toBe("function");
		expect(typeof client.alert.create).toBe("function");
		expect(typeof client.heartbeat.create).toBe("function");
	});
});
