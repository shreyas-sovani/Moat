import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, ZERO_ADDRESS, loadEnv, loadVerified } from "../src/config.ts";

const ZERO = ZERO_ADDRESS;
const LLTV = "915000000000000000";
const WRAP_ETH = "0.019";
const WRAP_WEI = "19000000000000000";
const SUPPLY_USDC = "50000000";
const BORROW_USDC = "31000000";
const ORACLE_SALT = execFileSync("cast", ["keccak", "moat-weth-usdc-84532-v1"], {
	encoding: "utf8",
}).trim();
const JOURNAL = join(REPO_ROOT, "docs/journal/vm1");
const STATE_PATH = join(JOURNAL, "seed-state.json");

interface SeedState {
	oracle?: string;
	marketId?: string;
	wrapWei?: string;
	wrapEth?: string;
	txs: Record<string, string>;
}

interface KhResponse {
	status: number;
	body: unknown;
}

function loadDotenv(path: string): void {
	if (!existsSync(path)) return;
	for (const raw of readFileSync(path, "utf8").split("\n")) {
		const line = raw.trim();
		if (line.length === 0 || line.startsWith("#")) continue;
		const eq = line.indexOf("=");
		if (eq < 1) continue;
		const key = line.slice(0, eq);
		let value = line.slice(eq + 1);
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) process.env[key] = value;
	}
}

function asRecord(value: unknown): Record<string, unknown> {
	if (typeof value === "object" && value !== null) {
		return value as Record<string, unknown>;
	}
	return {};
}

function splitMapped(mapped: string): { method: string; path: string } {
	const space = mapped.indexOf(" ");
	if (space === -1) return { method: "GET", path: mapped };
	return { method: mapped.slice(0, space), path: mapped.slice(space + 1) };
}

function loadState(): SeedState {
	if (!existsSync(STATE_PATH)) return { txs: {} };
	const parsed = JSON.parse(readFileSync(STATE_PATH, "utf8")) as SeedState;
	return {
		txs: parsed.txs ?? {},
		oracle: parsed.oracle,
		marketId: parsed.marketId,
		wrapWei: parsed.wrapWei,
		wrapEth: parsed.wrapEth,
	};
}

function saveState(state: SeedState): void {
	mkdirSync(JOURNAL, { recursive: true });
	writeFileSync(STATE_PATH, `${JSON.stringify(state, null, "\t")}\n`);
}

function writeJson(name: string, value: unknown): void {
	mkdirSync(JOURNAL, { recursive: true });
	writeFileSync(join(JOURNAL, name), `${JSON.stringify(value, null, "\t")}\n`);
}

function cast(args: string[], rpc: string): string {
	return execFileSync("cast", [...args, "--rpc-url", rpc], { encoding: "utf8" }).trim();
}

loadDotenv(join(REPO_ROOT, ".env"));
loadDotenv(join(REPO_ROOT, "..", ".env"));
const env = loadEnv();
const verified = loadVerified();
if (verified.network.chainId !== "84532") {
	throw new Error(`refusing chain ${verified.network.chainId}`);
}
if (!env.KEEPERHUB_API_KEY) {
	throw new Error("KEEPERHUB_API_KEY missing");
}

const allow = env.CHAIN_ALLOWLIST.split(",").map((s) => s.trim());
if (!allow.includes(verified.network.chainId)) {
	throw new Error("chain not in CHAIN_ALLOWLIST");
}

const rpc = verified.network.rpcUrl;
const chainId = verified.network.chainId;
const guardian = verified.keeperhub.wallet.address;
const blue = verified.morpho.blue;
const irm = verified.morpho.irm;
const factory = verified.morpho.oracleFactory;
const usdc = verified.tokens.USDC.address;
const weth = verified.tokens.WETH.address;
const ethUsd = verified.oracles.ETH_USD.address;
const restBase = verified.keeperhub.restBase;
const apiKey = env.KEEPERHUB_API_KEY;

const MARKET_PARAMS_COMPONENTS = [
	{ name: "loanToken", type: "address" },
	{ name: "collateralToken", type: "address" },
	{ name: "oracle", type: "address" },
	{ name: "irm", type: "address" },
	{ name: "lltv", type: "uint256" },
];

const WETH_ABI = [
	{
		type: "function",
		name: "deposit",
		stateMutability: "payable",
		inputs: [],
		outputs: [],
	},
];

const ERC20_ABI = [
	{
		type: "function",
		name: "approve",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "spender", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
	},
];

const FACTORY_ABI = [
	{
		type: "function",
		name: "createMorphoChainlinkOracleV2",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "baseVault", type: "address" },
			{ name: "baseVaultConversionSample", type: "uint256" },
			{ name: "baseFeed1", type: "address" },
			{ name: "baseFeed2", type: "address" },
			{ name: "baseTokenDecimals", type: "uint256" },
			{ name: "quoteVault", type: "address" },
			{ name: "quoteVaultConversionSample", type: "uint256" },
			{ name: "quoteFeed1", type: "address" },
			{ name: "quoteFeed2", type: "address" },
			{ name: "quoteTokenDecimals", type: "uint256" },
			{ name: "salt", type: "bytes32" },
		],
		outputs: [{ name: "oracle", type: "address" }],
	},
];

const MORPHO_ABI = [
	{
		type: "function",
		name: "createMarket",
		stateMutability: "nonpayable",
		inputs: [
			{
				name: "marketParams",
				type: "tuple",
				components: MARKET_PARAMS_COMPONENTS,
			},
		],
		outputs: [],
	},
	{
		type: "function",
		name: "supply",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "marketParams", type: "tuple", components: MARKET_PARAMS_COMPONENTS },
			{ name: "assets", type: "uint256" },
			{ name: "shares", type: "uint256" },
			{ name: "onBehalf", type: "address" },
			{ name: "data", type: "bytes" },
		],
		outputs: [
			{ name: "assetsSupplied", type: "uint256" },
			{ name: "sharesSupplied", type: "uint256" },
		],
	},
	{
		type: "function",
		name: "supplyCollateral",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "marketParams", type: "tuple", components: MARKET_PARAMS_COMPONENTS },
			{ name: "assets", type: "uint256" },
			{ name: "onBehalf", type: "address" },
			{ name: "data", type: "bytes" },
		],
		outputs: [],
	},
	{
		type: "function",
		name: "borrow",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "marketParams", type: "tuple", components: MARKET_PARAMS_COMPONENTS },
			{ name: "assets", type: "uint256" },
			{ name: "shares", type: "uint256" },
			{ name: "onBehalf", type: "address" },
			{ name: "receiver", type: "address" },
		],
		outputs: [
			{ name: "assetsBorrowed", type: "uint256" },
			{ name: "sharesBorrowed", type: "uint256" },
		],
	},
];

function mappedUrl(
	operation: string,
	params?: Record<string, string>,
): { method: string; url: string } {
	const mapped = verified.keeperhub.restEndpointsConfirmed[operation];
	if (!mapped) throw new Error(`unverified endpoint ${operation}`);
	const { method, path } = splitMapped(mapped);
	let resolved = path;
	if (params) {
		for (const [key, value] of Object.entries(params)) {
			resolved = resolved.replace(`{${key}}`, value);
		}
	}
	return { method, url: `${restBase}${resolved}` };
}

async function khFetch(
	operation: string,
	options: {
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		idempotency?: string;
	} = {},
): Promise<KhResponse> {
	const { method, url } = mappedUrl(operation, options.params);
	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
		Accept: "application/json",
	};
	if (options.body) headers["Content-Type"] = "application/json";
	if (options.idempotency) headers["Idempotency-Key"] = options.idempotency;
	const payload = options.body
		? {
				...options.body,
				...(options.idempotency ? { idempotency_key: options.idempotency } : {}),
			}
		: undefined;
	const response = await fetch(url, {
		method,
		headers,
		body: payload ? JSON.stringify(payload) : undefined,
	});
	const text = await response.text();
	let body: unknown = text;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	return { status: response.status, body };
}

function txHashFrom(body: unknown): string | undefined {
	const rec = asRecord(body);
	if (typeof rec.transactionHash === "string" && rec.transactionHash.startsWith("0x")) {
		return rec.transactionHash;
	}
	const receipts = rec.receipts;
	if (Array.isArray(receipts) && receipts[0]) {
		const hash = asRecord(receipts[0]).hash;
		if (typeof hash === "string" && hash.startsWith("0x")) return hash;
	}
	return undefined;
}

function executionIdFrom(body: unknown): string | undefined {
	const rec = asRecord(body);
	return typeof rec.executionId === "string" ? rec.executionId : undefined;
}

function addressFromSimulate(body: unknown): string | undefined {
	const rec = asRecord(body);
	const value = rec.simulatedReturnValue ?? rec.result;
	if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) return value;
	if (
		Array.isArray(value) &&
		typeof value[0] === "string" &&
		/^0x[0-9a-fA-F]{40}$/.test(value[0])
	) {
		return value[0];
	}
	return undefined;
}

function simulateOk(res: KhResponse): boolean {
	if (res.status >= 400) return false;
	const rec = asRecord(res.body);
	if (rec.wouldRevert === true) return false;
	if (rec.success === false) return false;
	return true;
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollExecution(executionId: string): Promise<unknown> {
	for (let i = 0; i < 40; i += 1) {
		const res = await khFetch("directExecutionStatus", { params: { executionId } });
		writeJson(`poll-${executionId}-${i}.json`, { http: res.status, body: res.body });
		const rec = asRecord(res.body);
		const status = rec.status;
		if (status === "completed" || status === "failed") return res.body;
		await sleep(2000);
	}
	throw new Error(`timeout polling ${executionId}`);
}

async function simulateThenBroadcast(
	step: string,
	call: {
		contractAddress: string;
		functionName: string;
		abi: unknown;
		functionArgs?: unknown[];
		value?: string;
	},
	state: SeedState,
): Promise<unknown> {
	if (state.txs[step]) {
		console.log(`skip ${step} already tx ${state.txs[step]}`);
		return { skipped: true, transactionHash: state.txs[step] };
	}
	const baseBody: Record<string, unknown> = {
		contractAddress: call.contractAddress,
		chainId,
		functionName: call.functionName,
		abi: JSON.stringify(call.abi),
	};
	if (call.functionArgs) baseBody.functionArgs = JSON.stringify(call.functionArgs);
	if (call.value) baseBody.value = call.value;

	const sim = await khFetch("directContractCall", {
		body: { ...baseBody, simulate: true },
	});
	writeJson(`sim-${step}.json`, { http: sim.status, body: sim.body });
	if (!simulateOk(sim)) {
		throw new Error(`${step} simulate failed HTTP ${sim.status}`);
	}

	const key = `moat:t1v2:${step}`;
	const live = await khFetch("directContractCall", {
		body: baseBody,
		idempotency: key,
	});
	writeJson(`live-${step}.json`, { http: live.status, body: live.body });
	if (live.status >= 400) {
		throw new Error(`${step} broadcast failed HTTP ${live.status}`);
	}
	let body = live.body;
	const executionId = executionIdFrom(body);
	let hash = txHashFrom(body);
	const rec = asRecord(body);
	if (executionId && (rec.status === "pending" || rec.status === "unconfirmed" || !hash)) {
		body = await pollExecution(executionId);
		hash = txHashFrom(body);
	}
	if (!hash) {
		throw new Error(`${step} missing transactionHash`);
	}
	const finalStatus = asRecord(body).status;
	if (finalStatus === "failed") {
		throw new Error(`${step} execution failed`);
	}
	state.txs[step] = hash;
	saveState(state);
	console.log(`${step} ${hash}`);
	return body;
}

function marketParams(oracle: string): Record<string, string> {
	return {
		loanToken: usdc,
		collateralToken: weth,
		oracle,
		irm,
		lltv: LLTV,
	};
}

function wordAddress(addr: string): string {
	return addr.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function wordUint(value: string): string {
	return BigInt(value).toString(16).padStart(64, "0");
}

function marketIdFromParams(oracle: string): string {
	const packed = `0x${wordAddress(usdc)}${wordAddress(weth)}${wordAddress(oracle)}${wordAddress(irm)}${wordUint(LLTV)}`;
	return execFileSync("cast", ["keccak", packed], { encoding: "utf8" }).trim();
}

async function main(): Promise<void> {
	mkdirSync(JOURNAL, { recursive: true });
	const integrations = await khFetch("listIntegrations");
	writeJson("ac-wallet-integrations.json", { http: integrations.status });
	if (integrations.status >= 400) {
		throw new Error(`listIntegrations HTTP ${integrations.status}`);
	}
	const integrationRows = Array.isArray(integrations.body)
		? integrations.body
		: Array.isArray(asRecord(integrations.body).integrations)
			? asRecord(integrations.body).integrations
			: [];
	const web3 = (Array.isArray(integrationRows) ? integrationRows : []).find((row) => {
		const rec = asRecord(row);
		return rec.id === verified.keeperhub.wallet.integrationId || rec.type === "web3";
	});
	writeJson("ac-wallet-match.json", {
		expected: guardian,
		integrationId: verified.keeperhub.wallet.integrationId,
		foundType: web3 ? asRecord(web3).type : null,
	});

	const spend = await khFetch("spendCap");
	writeJson("spend-cap.json", { http: spend.status, body: spend.body });
	if (spend.status >= 400) {
		throw new Error(`spendCap HTTP ${spend.status}`);
	}
	const spendBody = asRecord(spend.body);
	const capWei = BigInt(String(spendBody.effectiveDailyCapWei ?? "0"));
	const usedWei = BigInt(String(spendBody.dailyUsedWei ?? "0"));
	const remainingWei = capWei - usedWei;
	const wrapWei = BigInt(WRAP_WEI);

	const state = loadState();
	state.wrapWei = WRAP_WEI;
	state.wrapEth = WRAP_ETH;
	saveState(state);
	const wethBal = BigInt(
		cast(["call", weth, "balanceOf(address)(uint256)", guardian], rpc).split(" ")[0] ?? "0",
	);
	const needsWrap = wethBal < wrapWei && !state.txs.wrap;
	if (needsWrap && remainingWei < wrapWei) {
		throw new Error(`daily cap remaining ${remainingWei.toString()} < wrap ${WRAP_WEI}`);
	}
	if (needsWrap) {
		await simulateThenBroadcast(
			"wrap",
			{
				contractAddress: weth,
				functionName: "deposit",
				abi: WETH_ABI,
				functionArgs: [],
				value: WRAP_ETH,
			},
			state,
		);
	} else {
		console.log(`skip wrap WETH=${wethBal.toString()}`);
	}

	if (!state.oracle) {
		const simOracle = await khFetch("directContractCall", {
			body: {
				contractAddress: factory,
				chainId,
				functionName: "createMorphoChainlinkOracleV2",
				abi: JSON.stringify(FACTORY_ABI),
				functionArgs: JSON.stringify([
					ZERO,
					"1",
					ethUsd,
					ZERO,
					"18",
					ZERO,
					"1",
					ZERO,
					ZERO,
					"6",
					ORACLE_SALT,
				]),
				simulate: true,
			},
		});
		writeJson("sim-oracle.json", { http: simOracle.status, body: simOracle.body });
		if (!simulateOk(simOracle)) {
			throw new Error(`oracle simulate failed HTTP ${simOracle.status}`);
		}
		const predicted = addressFromSimulate(simOracle.body);
		const liveOracle = await simulateThenBroadcast(
			"oracle",
			{
				contractAddress: factory,
				functionName: "createMorphoChainlinkOracleV2",
				abi: FACTORY_ABI,
				functionArgs: [ZERO, "1", ethUsd, ZERO, "18", ZERO, "1", ZERO, ZERO, "6", ORACLE_SALT],
			},
			state,
		);
		let oracle = predicted ?? addressFromSimulate(liveOracle);
		if (!oracle && state.txs.oracle) {
			const receipt = execFileSync(
				"cast",
				["receipt", state.txs.oracle, "--rpc-url", rpc, "--json"],
				{ encoding: "utf8" },
			);
			writeJson("oracle-receipt.json", JSON.parse(receipt));
			const parsed = JSON.parse(receipt) as { logs?: Array<{ topics?: string[]; data?: string }> };
			const topic = execFileSync(
				"cast",
				["sig-event", "CreateMorphoChainlinkOracleV2(address,address)"],
				{ encoding: "utf8" },
			).trim();
			const log = parsed.logs?.find((item) => item.topics?.[0] === topic);
			if (log?.data) {
				const decoded = execFileSync(
					"cast",
					["decode-event", "CreateMorphoChainlinkOracleV2(address,address)", log.data],
					{ encoding: "utf8" },
				).trim();
				const match = decoded.match(/0x[0-9a-fA-F]{40}/g);
				oracle = match?.[1] ?? match?.[0];
			}
		}
		if (!oracle || !/^0x[0-9a-fA-F]{40}$/.test(oracle)) {
			throw new Error("could not resolve oracle address");
		}
		state.oracle = oracle;
		saveState(state);
		console.log(`oracle ${oracle}`);
	}

	const oracle = state.oracle;
	if (!oracle) throw new Error("oracle missing");

	const priceRaw = cast(["call", oracle, "price()(uint256)"], rpc);
	writeJson("oracle-price.txt", { raw: priceRaw });
	console.log(`oracle.price ${priceRaw}`);

	if (!state.marketId) {
		await simulateThenBroadcast(
			"createMarket",
			{
				contractAddress: blue,
				functionName: "createMarket",
				abi: MORPHO_ABI.filter((item) => item.name === "createMarket"),
				functionArgs: [marketParams(oracle)],
			},
			state,
		);
		const marketId = marketIdFromParams(oracle);
		state.marketId = marketId;
		saveState(state);
		console.log(`marketId ${marketId}`);
	}

	const marketId = state.marketId;
	if (!marketId) throw new Error("marketId missing");

	await simulateThenBroadcast(
		"approveUsdc",
		{
			contractAddress: usdc,
			functionName: "approve",
			abi: ERC20_ABI,
			functionArgs: [blue, SUPPLY_USDC],
		},
		state,
	);
	await simulateThenBroadcast(
		"approveWeth",
		{
			contractAddress: weth,
			functionName: "approve",
			abi: ERC20_ABI,
			functionArgs: [blue, state.wrapWei ?? WRAP_WEI],
		},
		state,
	);
	await simulateThenBroadcast(
		"supply",
		{
			contractAddress: blue,
			functionName: "supply",
			abi: MORPHO_ABI.filter((item) => item.name === "supply"),
			functionArgs: [marketParams(oracle), SUPPLY_USDC, "0", guardian, "0x"],
		},
		state,
	);
	await simulateThenBroadcast(
		"supplyCollateral",
		{
			contractAddress: blue,
			functionName: "supplyCollateral",
			abi: MORPHO_ABI.filter((item) => item.name === "supplyCollateral"),
			functionArgs: [marketParams(oracle), state.wrapWei ?? WRAP_WEI, guardian, "0x"],
		},
		state,
	);
	await simulateThenBroadcast(
		"borrow",
		{
			contractAddress: blue,
			functionName: "borrow",
			abi: MORPHO_ABI.filter((item) => item.name === "borrow"),
			functionArgs: [marketParams(oracle), BORROW_USDC, "0", guardian, guardian],
		},
		state,
	);

	const position = cast(
		["call", blue, "position(bytes32,address)(uint256,uint128,uint128)", marketId, guardian],
		rpc,
	);
	const market = cast(
		["call", blue, "market(bytes32)(uint128,uint128,uint128,uint128,uint128,uint128)", marketId],
		rpc,
	);
	writeJson("ac3-position.txt", { position, market, marketId, guardian });
	console.log("position", position);
	console.log("market", market);
	saveState(state);
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
