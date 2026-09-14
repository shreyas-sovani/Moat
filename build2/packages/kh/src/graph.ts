import { actionTypeSet, verifiedChainId } from "./chain.js";
import { KhGraphError } from "./errors.js";

export type NodeKind = "trigger" | "action" | "condition";

export interface WorkflowNode {
	id: string;
	type: NodeKind;
	data: {
		label: string;
		description?: string;
		type: NodeKind;
		config: Record<string, unknown>;
		status: "idle";
	};
}

export interface WorkflowEdge {
	id: string;
	source: string;
	target: string;
	sourceHandle?: "true" | "false";
}

export interface GraphJson {
	name: string;
	description: string;
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
}

export const TEMPLATE_REF = /^\{\{@[\w-]+:[^.\]]+\.[\w.]+\}\}$/;

export function validateGraphJson(
	obj: unknown,
	options?: { chainId?: string; actionTypes?: Set<string> },
): GraphJson {
	if (typeof obj !== "object" || obj === null) {
		throw new KhGraphError(["graph must be an object"]);
	}
	const graph = obj as GraphJson;
	const chainId = options?.chainId ?? verifiedChainId();
	const types = options?.actionTypes ?? actionTypeSet();
	const violations: string[] = [];

	if (!graph.name) violations.push("I6 missing name");
	if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
		throw new KhGraphError(["I6 nodes and edges must be arrays"]);
	}

	const byId = new Map<string, WorkflowNode>();
	for (const node of graph.nodes) {
		if (!node?.id) violations.push("I6 node missing id");
		else byId.set(node.id, node);
	}

	const triggers = graph.nodes.filter((n) => n.type === "trigger");
	if (triggers.length !== 1) violations.push("I6 missing trigger");

	for (const node of graph.nodes) {
		const network = node.data?.config?.network;
		if (network !== undefined && typeof network === "string" && network !== chainId) {
			violations.push("I1");
		}
		if (network !== undefined && typeof network !== "string") {
			violations.push("I1");
		}
		if (typeof node.data?.config?.simulate !== "undefined") {
			if (typeof node.data.config.simulate !== "boolean") {
				violations.push("I5");
			}
		}
		const actionType = node.data?.config?.actionType;
		if (typeof actionType === "string" && node.type === "action" && !types.has(actionType)) {
			violations.push("I3");
		}
		scanTemplates(node.data?.config, violations);
	}

	for (const edge of graph.edges) {
		if (!byId.has(edge.source) || !byId.has(edge.target)) {
			violations.push("I6");
		}
	}

	for (const node of graph.nodes) {
		if (!isConditionNode(node)) continue;
		const outgoing = graph.edges.filter((e) => e.source === node.id);
		const trues = outgoing.filter((e) => e.sourceHandle === "true");
		const falses = outgoing.filter((e) => e.sourceHandle === "false");
		if (trues.length !== 1 || falses.length !== 1) {
			violations.push("I2");
		}
	}

	if (violations.length > 0) {
		const unique = [...new Set(violations)];
		throw new KhGraphError(unique);
	}
	return graph;
}

function isConditionNode(node: WorkflowNode): boolean {
	if (node.type === "condition") return true;
	return node.data?.config?.actionType === "Condition";
}

function scanTemplates(value: unknown, violations: string[]): void {
	if (typeof value === "string") {
		if (value.includes("{{@")) {
			const matches = value.match(/\{\{@[^{}]+\}\}/g) ?? [];
			for (const match of matches) {
				if (!TEMPLATE_REF.test(match)) {
					violations.push("I4");
				}
			}
		}
		return;
	}
	if (Array.isArray(value)) {
		for (const item of value) scanTemplates(item, violations);
		return;
	}
	if (typeof value === "object" && value !== null) {
		for (const item of Object.values(value)) scanTemplates(item, violations);
	}
}

type Branch = "true" | "false";

export function wf(name: string, description: string) {
	const nodes: WorkflowNode[] = [];
	const edges: WorkflowEdge[] = [];
	let cursor: string | undefined;
	let conditionId: string | undefined;
	const branchTips: string[] = [];

	const addEdge = (source: string, target: string, handle?: Branch) => {
		const edge: WorkflowEdge = {
			id: `e-${source}-${target}${handle ? `-${handle}` : ""}`,
			source,
			target,
		};
		if (handle) edge.sourceHandle = handle;
		edges.push(edge);
	};

	const api = {
		trigger(triggerType: "Manual" | "Schedule" | "Webhook", cron?: string) {
			const id = "trigger-1";
			nodes.push({
				id,
				type: "trigger",
				data: {
					label: triggerType,
					type: "trigger",
					status: "idle",
					config: {
						triggerType,
						...(triggerType === "Schedule"
							? { scheduleCron: cron ?? "*/30 * * * *", scheduleTimezone: "UTC" }
							: {}),
					},
				},
			});
			cursor = id;
			return api;
		},
		readBalance(id: string, address: string) {
			nodes.push({
				id,
				type: "action",
				data: {
					label: "Check Balance",
					type: "action",
					status: "idle",
					config: {
						actionType: "web3/check-balance",
						network: verifiedChainId(),
						address,
					},
				},
			});
			if (cursor) addEdge(cursor, id);
			cursor = id;
			return api;
		},
		condition(id: string, cfg: { left: string; operator: string; right: string; label?: string }) {
			nodes.push({
				id,
				type: "action",
				data: {
					label: cfg.label ?? "Condition",
					type: "action",
					status: "idle",
					config: {
						actionType: "Condition",
						group: {
							id: `${id}-group`,
							logic: "AND",
							rules: [
								{
									id: `${id}-rule`,
									operator: cfg.operator,
									leftOperand: cfg.left,
									rightOperand: cfg.right,
								},
							],
						},
						condition: `${cfg.left} ${cfg.operator} ${cfg.right}`,
					},
				},
			});
			if (cursor) addEdge(cursor, id);
			cursor = id;
			conditionId = id;
			return api;
		},
		action(opts: {
			id: string;
			if?: Branch;
			actionType: string;
			label?: string;
			config?: Record<string, unknown>;
		}) {
			if (conditionId && !opts.if) {
				throw new KhGraphError(["I6 dangling if branch"]);
			}
			nodes.push({
				id: opts.id,
				type: "action",
				data: {
					label: opts.label ?? opts.actionType,
					type: "action",
					status: "idle",
					config: {
						actionType: opts.actionType,
						network: verifiedChainId(),
						...opts.config,
					},
				},
			});
			if (opts.if && conditionId) {
				addEdge(conditionId, opts.id, opts.if);
				branchTips.push(opts.id);
			} else if (cursor) {
				addEdge(cursor, opts.id);
			}
			cursor = opts.id;
			return api;
		},
		notify(id: string, chatId: string, message: string) {
			nodes.push({
				id,
				type: "action",
				data: {
					label: "Notify",
					type: "action",
					status: "idle",
					config: {
						actionType: "telegram/send-message",
						chatId,
						message,
					},
				},
			});
			const sources = branchTips.length > 0 ? branchTips : cursor ? [cursor] : [];
			for (const source of sources) addEdge(source, id);
			cursor = id;
			branchTips.length = 0;
			conditionId = undefined;
			return api;
		},
		build(): GraphJson {
			return validateGraphJson({ name, description, nodes, edges });
		},
	};
	return api;
}
