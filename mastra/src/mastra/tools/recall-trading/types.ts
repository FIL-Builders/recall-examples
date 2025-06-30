import { z } from "zod";

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface TokenInfo {
  address: string;
  chain: "evm" | "svm";
  specificChain: string;
  symbol: string;
}

export interface BalanceEntry {
  id: number;
  agentId: string;
  tokenAddress: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  specificChain: string;
  symbol: string;
  chain: string;
}

export interface PortfolioResponse {
  success: boolean;
  agentId: string;
  balances: BalanceEntry[];
}

export interface TokenInfoResponse {
  success: boolean;
  price: number;
  token: string;
  chain: "evm" | "svm";
  specificChain: string;
  symbol: string;
}

// ============================================================================
// SUPPORTED TOKENS AND CHAINS
// ============================================================================

export const SUPPORTED_TOKENS = ["USDC", "WETH", "USDT", "SOL"] as const;
export type SupportedToken = (typeof SUPPORTED_TOKENS)[number];

export const SUPPORTED_CHAINS = [
  "eth",
  "polygon",
  "base",
  "arbitrum",
  "optimism",
  "svm",
] as const;
export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

// ============================================================================
// TOKEN CONFIGURATION
// ============================================================================

export const TOKEN_DECIMALS: Record<SupportedToken, number> = {
  USDC: 6,
  WETH: 18,
  USDT: 6,
  SOL: 9,
};

export const SYMBOL_VARIANTS: Record<string, SupportedToken> = {
  USDC: "USDC",
  USDbC: "USDC", // Base USDC variant
  WETH: "WETH",
  ETH: "WETH",
  USDT: "USDT",
  SOL: "SOL",
};

// ============================================================================
// ZOD SCHEMAS FOR TOOLS
// ============================================================================

export const TokenInfoSchema = z.object({
  success: z
    .boolean()
    .describe("Whether the token info request was successful"),
  price: z.number().describe("Current USD price of the token"),
  token: z.string().describe("Token contract address that was queried"),
  chain: z
    .enum(["evm", "svm"])
    .describe("Blockchain type (evm for Ethereum-compatible, svm for Solana)"),
  specificChain: z
    .string()
    .describe(
      "Specific blockchain network (eth, polygon, base, arbitrum, optimism, svm)"
    ),
  symbol: z.string().describe("Token symbol (e.g., USDC, WETH, SOL)"),
  error: z.string().optional().describe("Error message if the request failed"),
});

export const PriceToolSchema = z.object({
  success: z.boolean().describe("Whether all price requests were successful"),
  prices: z
    .record(z.string(), z.number())
    .describe("Object mapping token symbols to their USD prices"),
  tokenInfo: z
    .record(
      z.string(),
      z.object({
        symbol: z.string().describe("Token symbol"),
        chain: z.string().describe("Blockchain type"),
        specificChain: z.string().describe("Specific blockchain network"),
        address: z.string().describe("Token contract address"),
      })
    )
    .optional()
    .describe(
      "Detailed information about each token including addresses and chain details"
    ),
  errors: z
    .array(z.string())
    .optional()
    .describe("Array of error messages for any failed price requests"),
});

export const PortfolioToolSchema = z.object({
  success: z.boolean().describe("Whether the portfolio request was successful"),
  agentId: z.string().describe("Unique identifier for the trading agent"),
  balances: z
    .array(
      z.object({
        id: z.number().describe("Unique balance entry ID"),
        agentId: z.string().describe("Trading agent identifier"),
        tokenAddress: z.string().describe("Token contract address"),
        amount: z
          .number()
          .describe(
            "Token amount in whole units (not wei/smallest denomination)"
          ),
        createdAt: z
          .string()
          .describe("ISO timestamp when balance was first recorded"),
        updatedAt: z
          .string()
          .describe("ISO timestamp when balance was last updated"),
        specificChain: z
          .string()
          .describe("Blockchain network where token is held"),
        symbol: z
          .string()
          .describe("Token symbol (USDC, WETH, USDT, SOL, etc.)"),
        chain: z.string().describe("Blockchain type (evm or svm)"),
        price: z
          .number()
          .optional()
          .describe(
            "Current USD price per token (included when includePricing=true)"
          ),
        valueUSD: z
          .number()
          .optional()
          .describe(
            "Total USD value of this balance (amount × price, when includePricing=true)"
          ),
      })
    )
    .describe("Array of all token balances in the portfolio"),
  summary: z
    .record(z.string(), z.number())
    .optional()
    .describe(
      "Aggregated balances by token symbol across all chains (when groupBySymbol=true)"
    ),
  pricing: z
    .record(
      z.string(),
      z.object({
        symbol: z.string().describe("Token symbol"),
        price: z.number().describe("Current USD price"),
        chain: z.string().describe("Blockchain type"),
        specificChain: z.string().describe("Specific blockchain network"),
      })
    )
    .optional()
    .describe(
      "Price information for all tokens in portfolio (when includePricing=true)"
    ),
  totalValue: z
    .number()
    .optional()
    .describe(
      "Total portfolio value in USD across all tokens and chains (when includePricing=true)"
    ),
});

export const TradeExecutionToolSchema = z.object({
  success: z.boolean().describe("Whether the trade was successfully executed"),
  status: z
    .string()
    .describe("Trade execution status (executed, insufficient_balance, etc.)"),
  txHash: z
    .string()
    .optional()
    .describe("Blockchain transaction hash for the executed trade"),
  message: z
    .string()
    .describe("Human-readable description of the trade result"),
  balanceCheck: z
    .object({
      availableBalance: z
        .number()
        .describe("Available token balance before trade"),
      requestedAmount: z.number().describe("Amount requested to trade"),
      sufficient: z
        .boolean()
        .describe("Whether balance was sufficient for the trade"),
      tokenInfo: z
        .object({
          address: z.string().describe("Source token contract address"),
          chain: z.string().describe("Source token blockchain type"),
          specificChain: z
            .string()
            .describe("Source token specific blockchain network"),
        })
        .describe("Information about the source token"),
    })
    .optional()
    .describe("Balance validation results performed before trade execution"),
  tradeDetails: z
    .object({
      fromToken: z.string().describe("Source token address or symbol"),
      toToken: z.string().describe("Destination token address or symbol"),
      fromChain: z
        .string()
        .describe("Source blockchain (format: type:network)"),
      toChain: z
        .string()
        .describe("Destination blockchain (format: type:network)"),
    })
    .optional()
    .describe("Detailed information about the executed trade"),
});

// Additional schema for allocation analysis
export const AllocationAnalysisSchema = z.object({
  totalValueUSD: z.number(),
  currentAllocation: z.record(z.string(), z.number()),
  targetAllocation: z.record(z.string(), z.number()),
  allocationDrift: z.record(z.string(), z.number()),
  needsRebalancing: z.boolean(),
  rebalancingPlan: z.array(
    z.object({
      action: z.enum(["buy", "sell"]),
      symbol: z.string(),
      currentAmount: z.number(),
      targetAmount: z.number(),
      differenceAmount: z.number(),
      differenceValueUSD: z.number(),
      priority: z.number(),
      preferredChain: z.string(),
    })
  ),
});
