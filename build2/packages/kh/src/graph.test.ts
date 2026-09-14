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

function condNode(graph: GraphJson) {
	const node = graph.nodes.find((n) => n.id === "cond-1");
	if (!node) throw new Error("expected cond-1");
	return node;
}

describe("graph builder", () => {
	it("I1-I6: valid graph against real dump", () => {
		const schemas = loadActionSchemas();
		expect(schemas.actions.length).toBeGreaterThan(10);
		expect(schemas.actions.some((a) => a.type === "Condition")).toBe(true);
		const graph = sampleGraph();
		expect(validateGraphJson(graph).nodes.length).toBeGreaterThan(3);
		expect(loadVerified().network.chainId).toBe("84532");
		for (const node of graph.nodes) {
			const network = node.data.config.network;
			if (network !== undefined) {
				expect(network).toBe("84532");
			}
		}
	});

	it("builds trigger→read→condition→true/false→notify", () => {
		const graph = sampleGraph();
		const cond = condNode(graph);
		expect(cond.type).toBe("action");
		expect(cond.data.config.actionType).toBe("Condition");
		const condEdges = graph.edges.filter((e) => e.source === "cond-1");
		expect(condEdges.some((e) => e.sourceHandle === "true")).toBe(true);
		expect(condEdges.some((e) => e.sourceHandle === "false")).toBe(true);
	});

	it("I1: wrong network throws KhGraphError naming I1", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		const node = graph.nodes.find((n) => n.data.config.network);
		if (!node) throw new Error("expected network node");
		node.data.config.network = "1";
		expect(() => validateGraphJson(graph)).toThrow(KhGraphError);
		expect(() => validateGraphJson(graph)).toThrow(/I1/);
	});

	it("I2: condition missing false edge throws naming I2", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		graph.edges = graph.edges.filter((e) => e.sourceHandle !== "false");
		expect(() => validateGraphJson(graph)).toThrow(/I2/);
	});

	it("I3: unknown actionType throws naming I3", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		const action = graph.nodes.find((n) => n.id === "true-1");
		if (!action) throw new Error("expected action");
		action.data.config.actionType = "not-a-real/action";
		expect(() => validateGraphJson(graph)).toThrow(/I3/);
	});

	it("I4: malformed template ref throws naming I4", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		condNode(graph).data.config.condition = "{{@bad}}";
		expect(() => validateGraphJson(graph)).toThrow(/I4/);
	});

	it("I5: simulate as string throws naming I5", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		const withSim = graph.nodes.find((n) => n.id === "true-1");
		if (!withSim) throw new Error("expected action");
		withSim.data.config.simulate = "true";
		expect(() => validateGraphJson(graph)).toThrow(/I5/);
	});

	it("I6: orphan edge throws naming I6", () => {
		const graph = structuredClone(sampleGraph()) as GraphJson;
		graph.edges.push({ id: "orphan", source: "missing", target: "true-1" });
		expect(() => validateGraphJson(graph)).toThrow(/I6/);
	});
});
