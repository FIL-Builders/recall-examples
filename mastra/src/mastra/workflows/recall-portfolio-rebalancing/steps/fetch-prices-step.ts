import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { PriceDataSchema, ConfigSchema, ChainSchema } from "../types";
import {
  DEFAULT_TARGET_ALLOCATION,
  DEFAULT_REBALANCE_THRESHOLD,
  DEFAULT_MIN_TRADE_VALUE_USD,
  DEFAULT_MAX_SLIPPAGE,
} from "../constants";
import { recallTradingTools } from "../../../tools/recall-trading-tools";

/**
 * Step 1: Fetch current market prices and build target allocation from simple inputs
 */
export const fetchPricesStep = createStep({
  id: "fetch-prices",
  description:
    "Fetch current market prices and build target allocation from user inputs",
  inputSchema: z.object({
    usdcPercent: z.coerce.number().min(0).max(100).optional(),
    wethPercent: z.coerce.number().min(0).max(100).optional(),
    usdtPercent: z.coerce.number().min(0).max(100).optional(),
    solPercent: z.coerce.number().min(0).max(100).optional(),
    consolidateToChain: ChainSchema.optional(),
    slippage: z.coerce.number().min(0.1).max(10).optional().default(2.0),
    forceRebalance: z.boolean().optional().default(false),
    skipConsolidation: z.boolean().optional().default(false),
  }),
  outputSchema: z.object({
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    console.log("🔍 Fetching current market prices...");

    // Build target allocation from individual percentage inputs
    const rawAllocation: Record<string, number> = {};

    // Add non-zero percentages to the allocation
    if (inputData.usdcPercent && inputData.usdcPercent > 0) {
      rawAllocation.USDC = inputData.usdcPercent;
    }
    if (inputData.wethPercent && inputData.wethPercent > 0) {
      rawAllocation.WETH = inputData.wethPercent;
    }
    if (inputData.usdtPercent && inputData.usdtPercent > 0) {
      rawAllocation.USDT = inputData.usdtPercent;
    }
    if (inputData.solPercent && inputData.solPercent > 0) {
      rawAllocation.SOL = inputData.solPercent;
    }

    // Use default allocation if no percentages provided
    let normalizedTargetAllocation: Record<string, number>;

    if (Object.keys(rawAllocation).length === 0) {
      console.log("📊 No allocation percentages provided, using defaults");
      normalizedTargetAllocation = DEFAULT_TARGET_ALLOCATION;
    } else {
      console.log("📊 User allocation percentages:", rawAllocation);

      // Calculate total and normalize to decimal (sum = 1.0)
      const totalPercent = Object.values(rawAllocation).reduce(
        (sum, value) => sum + value,
        0
      );

      if (totalPercent <= 0) {
        throw new Error("Allocation percentages must sum to a positive number");
      }

      // Normalize to percentages that sum to 1.0
      normalizedTargetAllocation = {};
      for (const [token, percent] of Object.entries(rawAllocation)) {
        normalizedTargetAllocation[token] = percent / totalPercent;
      }

      console.log(
        "✅ Normalized target allocation:",
        Object.fromEntries(
          Object.entries(normalizedTargetAllocation).map(([k, v]) => [
            k,
            `${(v * 100).toFixed(1)}%`,
          ])
        )
      );
    }

    // Merge user config with defaults
    const config = {
      targetAllocation: normalizedTargetAllocation,
      consolidateToChain: inputData.consolidateToChain, // Store user preference
      rebalanceThreshold: DEFAULT_REBALANCE_THRESHOLD,
      minTradeValueUSD: DEFAULT_MIN_TRADE_VALUE_USD,
      maxSlippage: inputData.slippage.toString(),
      forceRebalance: inputData.forceRebalance,
      skipConsolidation: inputData.skipConsolidation,
    };

    console.log("⚙️ Final configuration:", config);

    const result = await recallTradingTools.getPrice.execute({
      context: {
        symbols: ["USDC", "WETH", "USDT", "SOL"],
        // Get prices from multiple chains for comparison
        specificChain: "eth",
      },
      mastra,
      runtimeContext,
    });

    console.log("💰 Current prices:", result.prices);
    return { prices: result, config };
  },
});
