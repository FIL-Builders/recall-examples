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
  success: z.boolean(),
  price: z.number(),
  token: z.string(),
  chain: z.enum(["evm", "svm"]),
  specificChain: z.string(),
  symbol: z.string(),
  error: z.string().optional(),
});

export const PriceToolSchema = z.object({
  success: z.boolean(),
  prices: z.record(z.string(), z.number()),
  tokenInfo: z
    .record(
      z.string(),
      z.object({
        symbol: z.string(),
        chain: z.string(),
        specificChain: z.string(),
        address: z.string(),
      })
    )
    .optional(),
  errors: z.array(z.string()).optional(),
});

export const PortfolioToolSchema = z.object({
  success: z.boolean(),
  agentId: z.string(),
  balances: z.array(
    z.object({
      id: z.number(),
      agentId: z.string(),
      tokenAddress: z.string(),
      amount: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
      specificChain: z.string(),
      symbol: z.string(),
      chain: z.string(),
      price: z.number().optional(),
      valueUSD: z.number().optional(),
    })
  ),
  summary: z.record(z.string(), z.number()).optional(),
  pricing: z
    .record(
      z.string(),
      z.object({
        symbol: z.string(),
        price: z.number(),
        chain: z.string(),
        specificChain: z.string(),
      })
    )
    .optional(),
  totalValue: z.number().optional(),
});

export const TradeExecutionToolSchema = z.object({
  success: z.boolean(),
  status: z.string(),
  txHash: z.string().optional(),
  message: z.string(),
  balanceCheck: z
    .object({
      availableBalance: z.number(),
      requestedAmount: z.number(),
      sufficient: z.boolean(),
      tokenInfo: z.object({
        address: z.string(),
        chain: z.string(),
        specificChain: z.string(),
      }),
    })
    .optional(),
  tradeDetails: z
    .object({
      fromToken: z.string(),
      toToken: z.string(),
      fromChain: z.string(),
      toChain: z.string(),
    })
    .optional(),
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
