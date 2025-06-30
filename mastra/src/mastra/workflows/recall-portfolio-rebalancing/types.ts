import { z } from "zod";

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const TokenSchema = z.enum(["USDC", "WETH", "USDT", "SOL"]);
export const ChainSchema = z.enum([
  "eth",
  "polygon",
  "base",
  "arbitrum",
  "optimism",
  "svm",
]);

export const PriceDataSchema = z.object({
  success: z.boolean(),
  prices: z.record(z.string(), z.number()),
  errors: z.array(z.string()).optional(),
});

export const PortfolioDataSchema = z.object({
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
    })
  ),
  summary: z.record(z.string(), z.number()).optional(),
});

export const ConfigSchema = z.object({
  targetAllocation: z.record(z.string(), z.number()),
  consolidateToChain: z.string().optional(),
  rebalanceThreshold: z.number(),
  minTradeValueUSD: z.number(),
  maxSlippage: z.string(),
  forceRebalance: z.boolean(),
  skipConsolidation: z.boolean(),
});

export const ChainAnalysisSchema = z.object({
  availableTokens: z.record(z.string(), z.array(z.string())), // chain -> tokens[]
  tokenDistribution: z.record(z.string(), z.record(z.string(), z.number())), // token -> chain -> amount
  chainValues: z.record(z.string(), z.number()), // chain -> total USD value
  consolidationPlan: z
    .array(
      z.object({
        fromChain: z.string(),
        toChain: z.string(),
        token: z.string(),
        amount: z.number(),
        valueUSD: z.number(),
      })
    )
    .optional(),
});

export const TradeExecutionSchema = z.object({
  success: z.boolean(),
  status: z.any(),
  message: z.string(),
  txHash: z.string().optional(),
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

// ============================================================================
// DERIVED TYPES
// ============================================================================

export type ChainAnalysisType = z.infer<typeof ChainAnalysisSchema>;
export type ConfigType = z.infer<typeof ConfigSchema>;
export type PriceDataType = z.infer<typeof PriceDataSchema>;
export type PortfolioDataType = z.infer<typeof PortfolioDataSchema>;
export type TradeExecutionType = z.infer<typeof TradeExecutionSchema>;
export type TokenType = z.infer<typeof TokenSchema>;
export type ChainType = z.infer<typeof ChainSchema>;

// ============================================================================
// TRADE TYPES
// ============================================================================

export interface TradeParams {
  action: "buy" | "sell";
  symbol: TokenType;
  currentAmount: number;
  targetAmount: number;
  differenceAmount: number;
  differenceValueUSD: number;
  priority: number;
  preferredChain: string;
}

export interface SubTradeParams extends TradeParams {
  subTradeIndex: number;
  totalSubTrades: number;
}

export interface TradeExecutionResult {
  result: any;
  success: boolean;
}
