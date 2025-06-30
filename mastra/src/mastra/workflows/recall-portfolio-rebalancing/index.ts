import { createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { ChainSchema } from "./types";
import {
  fetchPricesStep,
  analyzeChainDistributionStep,
  executeConsolidationStep,
  analyzeAllocationStep,
  executeRebalancingStep,
  generateReportStep,
} from "./steps";

/**
 * Smart cross-chain portfolio rebalancing workflow with modular architecture
 *
 * This workflow is built from modular components:
 * - types.ts: Shared type definitions and schemas
 * - constants.ts: Configuration constants and defaults
 * - utils.ts: Utility functions for trade execution and analysis
 * - steps/: Individual workflow steps as separate modules
 */
export const recallTradingWorkflow = createWorkflow({
  id: "recall-trading-workflow",
  description:
    "Smart cross-chain portfolio rebalancing with simple percentage inputs and continuous iteration",
  inputSchema: z.object({
    // Individual token allocation percentages (0-100)
    usdcPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("USDC allocation percentage (0-100)"),
    wethPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("WETH allocation percentage (0-100)"),
    usdtPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("USDT allocation percentage (0-100)"),
    solPercent: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("SOL allocation percentage (0-100)"),

    // Chain consolidation options
    consolidateToChain: z
      .enum(["eth", "polygon", "base", "arbitrum", "optimism", "svm"])
      .optional()
      .describe("Optional: Move all tokens to this chain before rebalancing"),

    // Trading parameters
    slippage: z.coerce
      .number()
      .min(0.1)
      .max(10)
      .optional()
      .default(2.0)
      .describe("Slippage tolerance percentage (0.1-10, default: 2.0)"),

    // Advanced options
    forceRebalance: z
      .boolean()
      .optional()
      .default(false)
      .describe("Force rebalancing even if portfolio is balanced"),
    skipConsolidation: z
      .boolean()
      .optional()
      .default(false)
      .describe("Skip chain consolidation step"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.object({
      timestamp: z.string(),
      portfolioValueUSD: z.number(),
      consolidationExecuted: z.boolean(),
      consolidationTrades: z.number(),
      rebalancingRequired: z.boolean(),
      rebalancingTrades: z.number(),
      totalVolumeUSD: z.number(),
      allocationBefore: z.record(z.string(), z.number()),
      allocationTarget: z.record(z.string(), z.number()),
      allocationFinal: z.record(z.string(), z.number()),
      maxDriftBefore: z.number(),
      maxDriftAfter: z.number(),
      iterationsCompleted: z.number(),
      recommendations: z.array(z.string()),
    }),
    details: z.any(),
  }),
})
  .then(fetchPricesStep)
  .then(analyzeChainDistributionStep)
  .then(executeConsolidationStep)
  .then(analyzeAllocationStep)
  .then(executeRebalancingStep)
  .then(generateReportStep)
  .commit();

console.log(
  "🚀 Smart Recall Trading Workflow v5.0 initialized with modular architecture"
);

// Export individual components for testing and reuse
export * from "./types";
export * from "./constants";
export * from "./utils";
export * from "./steps";
