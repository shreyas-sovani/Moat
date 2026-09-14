import { loadVerified } from "@moat/infra";
import { KeeperHubClient, idempotencyKey, wf } from "../src/index.ts";

const verified = loadVerified();
const key = process.env.KEEPERHUB_API_KEY ?? "";
if (!key) {
	console.error("KEEPERHUB_API_KEY missing — smoke is a live call");
	process.exit(1);
}

const client = new KeeperHubClient();
const date = new Date().toISOString().slice(0, 10);
const idem = idempotencyKey("smoke", date);
const graph = wf("moat-smoke", "disabled smoke workflow")
	.trigger("Manual")
	.readBalance("read-1", verified.keeperhub.wallet.address)
	.condition("cond-1", {
		left: "{{@read-1:Check Balance.balance}}",
		operator: ">",
		right: "-1",
	})
	.action({
		id: "ok",
		if: "true",
		actionType: "web3/check-balance",
		config: { address: verified.keeperhub.wallet.address },
	})
	.action({
		id: "skip",
		if: "false",
		actionType: "web3/check-balance",
		config: { address: verified.keeperhub.wallet.address },
	})
	.notify("notify-1", "0", "moat smoke")
	.build();

const created = (await client.createWorkflow(graph, idem, false)) as { id?: string };
const id = created.id;
if (!id) {
	console.error("create did not return id", created);
	process.exit(1);
}
const listed = (await client.listWorkflows()) as Array<{ id: string }>;
if (!listed.some((row) => row.id === id)) {
	console.error("created workflow not in list");
	process.exit(1);
}
await client.deleteWorkflow(id);
console.log(JSON.stringify({ ok: true, workflowId: id, idempotency: idem }));
