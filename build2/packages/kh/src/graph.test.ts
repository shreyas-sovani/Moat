import { loadActionSchemas, loadVerified } from "@moat/infra";
import { describe, expect, it } from "vitest";
import { KhGraphError } from "./errors.js";
import { type GraphJson, validateGraphJson, wf } from "./graph.js";

const FAKE_ADDR = "0x1111111111111111111111111111111111111111";

function sampleGraph() {
	return wf("moat-sample", "top-up guard")
		.trigger("Schedule", "*/30 * * * *")
		.readBalance("read-1", FAKE_ADDR)
		.condition("cond-1", {
			left: "{{@read-1:Check Balance.balance}}",
			operator: "<",
			right: "1",
		})
		.action({
			id: "true-1",
			if: "true",
			actionType: "web3/check-balance",
			config: { address: FAKE_ADDR },
		})
		.action({
			id: "false-1",
			if: "false",
			actionType: "web3/check-balance",
			config: { address: FAKE_ADDR },
		})
		.notify("notify-1", "0", "guard fired {{@read-1:Check Balance.balance}}")
		.build();
}

describe("graph builder", () => {
	it("I1-I6: valid graph against real dump", () => {
		const schemas = loadActionSchemas();
		expect(schemas.actions.length).toBeGreaterThan(10);
		const graph = sampleGraph();
		expect(validateGraphJson(graph).nodes.length).toBeGreaterThan(3);
		expect(loadVerified().network.chainId).toBe("84532");
	});

	it("builds trigger→read→condition→true/false→notify", () => {
		const graph = sampleGraph();
		const condEdges = graph.edges.filter((e) => e.source === "cond-1");
		expect(condEdges.some((e) => e.sourceHandle === "true")).toBe(true);
		expect(condEdges.some((e) => e.sourceHandle === "false")).toBe(true);
	});

	it("mutation tests name the invariant", () => {
		const graph = sampleGraph();
		const i1 = structuredClone(graph) as GraphJson;
		const node = i1.nodes.find((n) => n.data.config.network);
		if (!node) throw new Error("expected network node");
		node.data.config.network = "1";
		expect(() => validateGraphJson(i1)).toThrow(KhGraphError);
		expect(() => validateGraphJson(i1)).toThrow(/I1/);

		const i2 = structuredClone(graph) as GraphJson;
		i2.edges = i2.edges.filter((e) => e.sourceHandle !== "false");
		expect(() => validateGraphJson(i2)).toThrow(/I2/);

		const i3 = structuredClone(graph) as GraphJson;
		const action = i3.nodes.find((n) => n.id === "true-1");
		if (!action) throw new Error("expected action");
		action.data.config.actionType = "not-a-real/action";
		expect(() => validateGraphJson(i3)).toThrow(/I3/);

		const i4 = structuredClone(graph) as GraphJson;
		const cond = i4.nodes.find((n) => n.type === "condition");
		if (!cond) throw new Error("expected condition");
		cond.data.config.condition = "{{@bad}}";
		expect(() => validateGraphJson(i4)).toThrow(/I4/);

		const i5 = structuredClone(graph) as GraphJson;
		const withSim = i5.nodes.find((n) => n.id === "true-1");
		if (!withSim) throw new Error("expected action");
		withSim.data.config.simulate = "true";
		expect(() => validateGraphJson(i5)).toThrow(/I5/);

		const i6 = structuredClone(graph) as GraphJson;
		i6.edges.push({ id: "orphan", source: "missing", target: "true-1" });
		expect(() => validateGraphJson(i6)).toThrow(/I6/);
	});
});
