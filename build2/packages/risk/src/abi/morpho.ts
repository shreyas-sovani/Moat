/** Morpho Blue views used by position sync. Totals live on `market(bytes32)`, not separate getters. */
export const MORPHO_VIEW_ABI = [
	{
		type: "function",
		name: "position",
		stateMutability: "view",
		inputs: [
			{ name: "id", type: "bytes32" },
			{ name: "user", type: "address" },
		],
		outputs: [
			{ name: "supplyShares", type: "uint256" },
			{ name: "borrowShares", type: "uint128" },
			{ name: "collateral", type: "uint128" },
		],
	},
	{
		type: "function",
		name: "market",
		stateMutability: "view",
		inputs: [{ name: "id", type: "bytes32" }],
		outputs: [
			{ name: "totalSupplyAssets", type: "uint128" },
			{ name: "totalSupplyShares", type: "uint128" },
			{ name: "totalBorrowAssets", type: "uint128" },
			{ name: "totalBorrowShares", type: "uint128" },
			{ name: "lastUpdate", type: "uint128" },
			{ name: "fee", type: "uint128" },
		],
	},
	{
		type: "function",
		name: "idToMarketParams",
		stateMutability: "view",
		inputs: [{ name: "id", type: "bytes32" }],
		outputs: [
			{ name: "loanToken", type: "address" },
			{ name: "collateralToken", type: "address" },
			{ name: "oracle", type: "address" },
			{ name: "irm", type: "address" },
			{ name: "lltv", type: "uint256" },
		],
	},
] as const;

const MARKET_PARAMS_COMPONENTS = [
	{ name: "loanToken", type: "address" },
	{ name: "collateralToken", type: "address" },
	{ name: "oracle", type: "address" },
	{ name: "irm", type: "address" },
	{ name: "lltv", type: "uint256" },
] as const;

/** Morpho Blue `supplyCollateral` — used by the default plan. Morpho plugin does not list 84532. */
export const MORPHO_SUPPLY_COLLATERAL_ABI = [
	{
		type: "function",
		name: "supplyCollateral",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "marketParams", type: "tuple", components: [...MARKET_PARAMS_COMPONENTS] },
			{ name: "assets", type: "uint256" },
			{ name: "onBehalf", type: "address" },
			{ name: "data", type: "bytes" },
		],
		outputs: [],
	},
] as const;

/** Morpho Blue `withdrawCollateral` — 3.5 drill. Morpho plugin does not list 84532. */
export const MORPHO_WITHDRAW_COLLATERAL_ABI = [
	{
		type: "function",
		name: "withdrawCollateral",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "marketParams", type: "tuple", components: [...MARKET_PARAMS_COMPONENTS] },
			{ name: "assets", type: "uint256" },
			{ name: "onBehalf", type: "address" },
			{ name: "receiver", type: "address" },
		],
		outputs: [],
	},
] as const;

/** Morpho Chainlink oracle V2 `price()` — 36-decimal collateral/loan quote. */
export const MORPHO_ORACLE_PRICE_ABI = [
	{
		type: "function",
		name: "price",
		stateMutability: "view",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
	},
] as const;
