import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PriceDataSchema,
  ConfigSchema,
  PortfolioDataSchema,
  ChainAnalysisSchema,
  TradeExecutionSchema,
  TokenSchema,
} from "../types";
import { CHAIN_PREFERENCES } from "../constants";

/**
 * Step 4: Analyze portfolio allocation and create rebalancing plan
 */
export const analyzeAllocationStep = createStep({
  id: "analyze-allocation",
  description:
    "Analyze current vs target allocation and create rebalancing plan",
  inputSchema: z.object({
    consolidationResults: z.array(TradeExecutionSchema),
    updatedPortfolio: PortfolioDataSchema,
    chainAnalysis: ChainAnalysisSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  outputSchema: z.object({
    analysis: z.object({
      totalValueUSD: z.number(),
      currentAllocation: z.record(z.string(), z.number()),
      targetAllocation: z.record(z.string(), z.number()),
      allocationDrift: z.record(z.string(), z.number()),
      needsRebalancing: z.boolean(),
      rebalancingPlan: z.array(
        z.object({
          action: z.enum(["buy", "sell"]),
          symbol: TokenSchema,
          currentAmount: z.number(),
          targetAmount: z.number(),
          differenceAmount: z.number(),
          differenceValueUSD: z.number(),
          priority: z.number(),
          preferredChain: z.string(),
        })
      ),
    }),
    consolidationResults: z.array(TradeExecutionSchema),
    updatedPortfolio: PortfolioDataSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  execute: async ({ inputData }) => {
    const { updatedPortfolio, prices, config, consolidationResults } =
      inputData;

    console.log("🧮 Analyzing portfolio allocation...");

    // Calculate total portfolio value and current allocation
    let totalValueUSD = 0;
    const currentAllocation: Record<string, number> = {};

    // Group balances by symbol (handle variants like USDbC)
    const symbolTotals: Record<string, number> = {};

    for (const balance of updatedPortfolio.balances) {
      const normalizedSymbol =
        balance.symbol === "USDbC" ? "USDC" : balance.symbol;
      symbolTotals[normalizedSymbol] =
        (symbolTotals[normalizedSymbol] || 0) + balance.amount;
    }

    // Calculate values and allocation percentages
    for (const [symbol, amount] of Object.entries(symbolTotals)) {
      const price = prices.prices[symbol] || 0;
      const valueUSD = amount * price;
      totalValueUSD += valueUSD;
      currentAllocation[symbol] = amount;
    }

    console.log(`💵 Total portfolio value: $${totalValueUSD.toFixed(2)}`);

    // Calculate current allocation percentages
    const currentAllocationPercent: Record<string, number> = {};
    for (const [symbol] of Object.entries(config.targetAllocation)) {
      const amount = currentAllocation[symbol] || 0;
      const price = prices.prices[symbol] || 0;
      const valueUSD = amount * price;
      currentAllocationPercent[symbol] =
        totalValueUSD > 0 ? valueUSD / totalValueUSD : 0;
    }

    // Calculate allocation drift
    const allocationDrift: Record<string, number> = {};
    let maxDrift = 0;

    for (const [symbol, targetPercent] of Object.entries(
      config.targetAllocation as Record<string, number>
    )) {
      const currentPercent = currentAllocationPercent[symbol] || 0;
      const drift = Math.abs(currentPercent - targetPercent);
      allocationDrift[symbol] = drift;
      maxDrift = Math.max(maxDrift, drift);
    }

    const needsRebalancing =
      config.forceRebalance || maxDrift > config.rebalanceThreshold;

    console.log(
      "📈 Current allocation:",
      Object.fromEntries(
        Object.entries(currentAllocationPercent).map(([k, v]) => [
          k,
          `${(v * 100).toFixed(1)}%`,
        ])
      )
    );
    console.log(
      "🎯 Target allocation:",
      Object.fromEntries(
        Object.entries(config.targetAllocation as Record<string, number>).map(
          ([k, v]) => [k, `${(v * 100).toFixed(1)}%`]
        )
      )
    );

    // Create rebalancing plan
    const rebalancingPlan = [];

    if (needsRebalancing) {
      console.log("⚖️ Portfolio needs rebalancing!");

      // First, identify all tokens that need to be bought/sold
      for (const [symbol, targetPercent] of Object.entries(
        config.targetAllocation as Record<string, number>
      )) {
        const currentAmount = currentAllocation[symbol] || 0;
        const price = prices.prices[symbol] || 0;
        const targetValueUSD = totalValueUSD * targetPercent;
        const targetAmount = price > 0 ? targetValueUSD / price : 0;
        const differenceAmount = targetAmount - currentAmount;
        const differenceValueUSD = Math.abs(differenceAmount * price);

        // Only include if the difference is significant
        if (differenceValueUSD >= config.minTradeValueUSD) {
          // Determine preferred chain (if consolidating, use that chain)
          const preferredChain =
            config.consolidateToChain ||
            CHAIN_PREFERENCES[symbol as keyof typeof CHAIN_PREFERENCES][0];

          rebalancingPlan.push({
            action: differenceAmount > 0 ? ("buy" as const) : ("sell" as const),
            symbol: symbol as any,
            currentAmount,
            targetAmount,
            differenceAmount: Math.abs(differenceAmount),
            differenceValueUSD,
            priority: allocationDrift[symbol] * 100,
            preferredChain,
          });
        }
      }

      // Also check for non-target tokens that should be sold (like excess USDC/stablecoins)
      for (const [symbol, amount] of Object.entries(symbolTotals)) {
        const targetPercent =
          (config.targetAllocation as Record<string, number>)[symbol] || 0;
        const price = prices.prices[symbol] || 0;
        const currentValueUSD = amount * price;

        // If this token has 0% target allocation but we have a significant amount, sell it
        if (targetPercent === 0 && currentValueUSD >= config.minTradeValueUSD) {
          const preferredChain = config.consolidateToChain || "eth";

          rebalancingPlan.push({
            action: "sell" as const,
            symbol: symbol as any,
            currentAmount: amount,
            targetAmount: 0,
            differenceAmount: amount,
            differenceValueUSD: currentValueUSD,
            priority: 50, // Medium priority for liquidating non-target assets
            preferredChain,
          });

          console.log(
            `📋 Added sell plan for non-target ${symbol}: ${amount.toFixed(2)} tokens ($${currentValueUSD.toFixed(2)})`
          );
        }
      }

      rebalancingPlan.sort((a, b) => b.priority - a.priority);
      console.log(
        `📋 Rebalancing plan: ${rebalancingPlan.length} actions needed`
      );

      // Log the plan details
      rebalancingPlan.forEach((plan, i) => {
        console.log(
          `  ${i + 1}. ${plan.action.toUpperCase()} ${plan.differenceAmount.toFixed(4)} ${plan.symbol} ($${plan.differenceValueUSD.toFixed(2)}) on ${plan.preferredChain}`
        );
      });
    } else {
      console.log("✅ Portfolio is well balanced, no rebalancing needed");
    }

    return {
      analysis: {
        totalValueUSD,
        currentAllocation: currentAllocationPercent,
        targetAllocation: config.targetAllocation,
        allocationDrift,
        needsRebalancing,
        rebalancingPlan,
      },
      consolidationResults,
      updatedPortfolio,
      prices,
      config,
    };
  },
});
