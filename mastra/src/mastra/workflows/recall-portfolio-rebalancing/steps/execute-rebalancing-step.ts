import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PriceDataSchema,
  ConfigSchema,
  TradeExecutionSchema,
  TokenSchema,
  PortfolioDataSchema,
  AllocationAnalysisSchema,
} from "../types";
import {
  splitTradeIntoSubTrades,
  executeSingleTrade,
  createTradeDelay,
} from "../utils";
import { REBALANCING_CONFIG } from "../constants";
import { recallTradingTools } from "../../../tools/recall-trading-tools";

/**
 * Step 5: Execute rebalancing trades with continuous iteration until target is reached
 */
export const executeRebalancingStep = createStep({
  id: "execute-rebalancing",
  description:
    "Execute trades to achieve target allocation with continuous iteration",
  inputSchema: z.object({
    analysis: AllocationAnalysisSchema,
    consolidationResults: z.array(TradeExecutionSchema),
    updatedPortfolio: PortfolioDataSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  outputSchema: z.object({
    rebalancingResults: z.array(TradeExecutionSchema),
    totalRebalancingTrades: z.number(),
    totalRebalancingVolumeUSD: z.number(),
    analysis: AllocationAnalysisSchema,
    consolidationResults: z.array(TradeExecutionSchema),
    finalAllocation: z.record(z.string(), z.number()),
    iterationsCompleted: z.number(),
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    let { analysis, updatedPortfolio, config } = inputData;
    const { prices } = inputData;

    if (!analysis.needsRebalancing) {
      console.log("✅ No rebalancing required");
      return {
        rebalancingResults: [],
        totalRebalancingTrades: 0,
        totalRebalancingVolumeUSD: 0,
        analysis,
        consolidationResults: inputData.consolidationResults,
        finalAllocation: analysis.currentAllocation,
        iterationsCompleted: 0,
      };
    }

    console.log("🔄 Starting continuous rebalancing process...");
    console.log(
      `📊 Total portfolio value: $${analysis.totalValueUSD.toFixed(2)}`
    );
    console.log(
      `⚠️ Max trade size limit: $${(analysis.totalValueUSD * 0.25).toFixed(2)} (25% of portfolio)`
    );

    const allRebalancingResults: any[] = [];
    let totalVolumeUSD = 0;
    let iterationsCompleted = 0;

    // Main rebalancing loop
    while (iterationsCompleted < REBALANCING_CONFIG.maxIterations) {
      iterationsCompleted++;
      console.log(`\n🔄 === Rebalancing Iteration ${iterationsCompleted} ===`);

      // Refresh portfolio and recalculate allocation
      console.log("📊 Refreshing portfolio and recalculating allocation...");
      const currentPortfolio = await recallTradingTools.getPortfolio.execute({
        context: {
          groupBySymbol: false,
          includeZeroBalances: false,
          includePricing: true,
        },
        mastra,
        runtimeContext,
      });

      // Recalculate current allocation
      let totalValueUSD = 0;
      const symbolTotals: Record<string, number> = {};

      for (const balance of currentPortfolio.balances) {
        const normalizedSymbol =
          balance.symbol === "USDbC" ? "USDC" : balance.symbol;
        symbolTotals[normalizedSymbol] =
          (symbolTotals[normalizedSymbol] || 0) + balance.amount;
      }

      // Calculate total portfolio value (including ALL tokens, not just target ones)
      for (const [symbol, amount] of Object.entries(symbolTotals)) {
        const price = prices.prices[symbol] || 0;
        const valueUSD = amount * price;
        totalValueUSD += valueUSD;
      }

      // Calculate current allocation percentages for target tokens only
      const currentAllocationPercent: Record<string, number> = {};
      for (const [symbol] of Object.entries(config.targetAllocation)) {
        const amount = symbolTotals[symbol] || 0;
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

      console.log(
        "📈 Current allocation:",
        Object.fromEntries(
          Object.entries(currentAllocationPercent).map(([k, v]) => [
            k,
            `${(v * 100).toFixed(1)}%`,
          ])
        )
      );

      console.log(`📏 Max drift: ${(maxDrift * 100).toFixed(2)}%`);

      // Check if we've reached target allocation
      if (
        !config.forceRebalance &&
        maxDrift <= REBALANCING_CONFIG.convergenceThreshold
      ) {
        console.log("🎯 Target allocation achieved! Stopping rebalancing.");
        break;
      }

      // Create new rebalancing plan for this iteration
      const iterationRebalancingPlan = [];

      // First, add target tokens that need to be bought/sold
      for (const [symbol, targetPercent] of Object.entries(
        config.targetAllocation as Record<string, number>
      )) {
        const currentAmount = symbolTotals[symbol] || 0;
        const price = prices.prices[symbol] || 0;
        const targetValueUSD = totalValueUSD * targetPercent;
        const targetAmount = price > 0 ? targetValueUSD / price : 0;
        const differenceAmount = targetAmount - currentAmount;
        const differenceValueUSD = Math.abs(differenceAmount * price);

        // Only include if the difference is significant
        if (differenceValueUSD >= config.minTradeValueUSD) {
          const preferredChain = config.consolidateToChain || "eth";

          iterationRebalancingPlan.push({
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

      // Also add non-target tokens that should be sold
      for (const [symbol, amount] of Object.entries(symbolTotals)) {
        const targetPercent =
          (config.targetAllocation as Record<string, number>)[symbol] || 0;
        const price = prices.prices[symbol] || 0;
        const currentValueUSD = amount * price;

        // If this token has 0% target allocation but we have a significant amount, sell it
        if (
          targetPercent === 0 &&
          currentValueUSD >= config.minTradeValueUSD &&
          amount > 0
        ) {
          const preferredChain = config.consolidateToChain || "eth";

          iterationRebalancingPlan.push({
            action: "sell" as const,
            symbol: symbol as any,
            currentAmount: amount,
            targetAmount: 0,
            differenceAmount: amount,
            differenceValueUSD: currentValueUSD,
            priority: 50, // Medium priority for liquidating non-target assets
            preferredChain,
          });
        }
      }

      if (iterationRebalancingPlan.length === 0) {
        console.log("✅ No more trades needed. Rebalancing complete!");
        break;
      }

      console.log(
        `📋 Iteration ${iterationsCompleted} executing ${iterationRebalancingPlan.length} planned trades:`
      );
      iterationRebalancingPlan.forEach((plan, i) => {
        console.log(
          `  ${i + 1}. ${plan.action.toUpperCase()} ${plan.differenceAmount.toFixed(4)} ${plan.symbol} ($${plan.differenceValueUSD.toFixed(2)}) on ${plan.preferredChain}`
        );
      });

      // Special handling: if we need to buy but have no stablecoins, prioritize sells first
      const iterationBuyTrades = iterationRebalancingPlan.filter(
        (trade) => trade.action === "buy"
      );
      const iterationSellTrades = iterationRebalancingPlan.filter(
        (trade) => trade.action === "sell"
      );

      if (iterationBuyTrades.length > 0 && iterationSellTrades.length === 0) {
        // Check if we have stablecoins available
        const currentStablecoins = currentPortfolio.balances.filter(
          (b: any) =>
            ["USDC", "USDbC", "DAI", "USDT"].includes(b.symbol) && b.amount > 0
        );

        if (currentStablecoins.length === 0) {
          console.log(
            "🔄 No stablecoins available for buying - need to sell non-target tokens first"
          );

          // Find the largest non-target token to sell
          const nonTargetTokens = currentPortfolio.balances.filter((b: any) => {
            const normalizedSymbol = b.symbol === "USDbC" ? "USDC" : b.symbol;
            const targetPercent =
              (config.targetAllocation as Record<string, number>)[
                normalizedSymbol
              ] || 0;
            return (
              targetPercent === 0 &&
              b.amount > 0 &&
              !["USDC", "USDbC", "DAI", "USDT"].includes(b.symbol)
            );
          });

          if (nonTargetTokens.length > 0) {
            // Sort by value and sell the largest one
            const tokenToSell = nonTargetTokens.reduce((max, current) => {
              const maxPrice =
                prices.prices[max.symbol === "USDbC" ? "USDC" : max.symbol] ||
                0;
              const currentPrice =
                prices.prices[
                  current.symbol === "USDbC" ? "USDC" : current.symbol
                ] || 0;
              return max.amount * maxPrice > current.amount * currentPrice
                ? max
                : current;
            });

            console.log(
              `🔄 Selling non-target token: ${tokenToSell.amount.toFixed(4)} ${tokenToSell.symbol} to get stablecoins`
            );

            const sellResult = await recallTradingTools.executeTrade.execute({
              context: {
                fromSymbol: tokenToSell.symbol as any,
                toSymbol: "USDC",
                amount: tokenToSell.amount,
                reason: `Converting non-target ${tokenToSell.symbol} to USDC for rebalancing`,
                slippageTolerance: config.maxSlippage,
                fromSpecificChain: tokenToSell.specificChain as any,
                toSpecificChain: tokenToSell.specificChain as any,
              },
              mastra,
              runtimeContext,
            });

            if (sellResult.success) {
              console.log(
                `✅ Successfully converted ${tokenToSell.symbol} to USDC`
              );
              allRebalancingResults.push(sellResult);
              totalVolumeUSD +=
                tokenToSell.amount * (prices.prices[tokenToSell.symbol] || 0);
            }

            // Continue to next iteration to re-evaluate
            await createTradeDelay(3000);
            continue;
          }
        }
      }

      iterationRebalancingPlan.sort((a, b) => b.priority - a.priority);

      // Execute trades for this iteration (limit for safety)
      const tradesToExecute = iterationRebalancingPlan.slice(
        0,
        REBALANCING_CONFIG.maxTradesPerIteration
      );

      // Separate sell and buy trades
      const sellTrades = tradesToExecute.filter(
        (trade) => trade.action === "sell"
      );
      const buyTrades = tradesToExecute.filter(
        (trade) => trade.action === "buy"
      );

      // Split large trades into sub-trades
      const splitSellTrades = sellTrades.flatMap((trade) =>
        splitTradeIntoSubTrades(trade, totalValueUSD)
      );
      const splitBuyTrades = buyTrades.flatMap((trade) =>
        splitTradeIntoSubTrades(trade, totalValueUSD)
      );

      console.log(
        `📋 Iteration ${iterationsCompleted} execution: ${splitSellTrades.length} sell sub-trades, ${splitBuyTrades.length} buy sub-trades`
      );

      // Execute sell trades first
      for (const trade of splitSellTrades) {
        const success = await executeSingleTrade(
          trade,
          "sell",
          currentPortfolio,
          config,
          analysis,
          mastra,
          runtimeContext,
          prices
        );

        if (success.result) {
          allRebalancingResults.push(success.result);
          if (success.result.success) {
            totalVolumeUSD += trade.differenceValueUSD;
          }
        }

        await createTradeDelay();
      }

      // Execute buy trades
      for (const trade of splitBuyTrades) {
        // Refresh portfolio again before each buy trade
        const refreshedPortfolio =
          await recallTradingTools.getPortfolio.execute({
            context: {
              groupBySymbol: false,
              includeZeroBalances: false,
              includePricing: true,
            },
            mastra,
            runtimeContext,
          });

        const success = await executeSingleTrade(
          trade,
          "buy",
          refreshedPortfolio,
          config,
          analysis,
          mastra,
          runtimeContext,
          prices
        );

        if (success.result) {
          allRebalancingResults.push(success.result);
          if (success.result.success) {
            totalVolumeUSD += trade.differenceValueUSD;
          }
        }

        await createTradeDelay();
      }

      // Brief pause between iterations
      console.log(
        `⏳ Iteration ${iterationsCompleted} complete. Pausing before next iteration...`
      );
      await createTradeDelay(2000);

      // Force rebalance to false after first iteration
      config.forceRebalance = false;
    }

    // Calculate final allocation
    const finalPortfolio = await recallTradingTools.getPortfolio.execute({
      context: {
        groupBySymbol: false,
        includeZeroBalances: false,
        includePricing: true,
      },
      mastra,
      runtimeContext,
    });

    let finalTotalValue = 0;
    const finalSymbolTotals: Record<string, number> = {};

    for (const balance of finalPortfolio.balances) {
      const normalizedSymbol =
        balance.symbol === "USDbC" ? "USDC" : balance.symbol;
      finalSymbolTotals[normalizedSymbol] =
        (finalSymbolTotals[normalizedSymbol] || 0) + balance.amount;
    }

    const finalAllocation: Record<string, number> = {};
    for (const [symbol] of Object.entries(config.targetAllocation)) {
      const amount = finalSymbolTotals[symbol] || 0;
      const price = prices.prices[symbol] || 0;
      const valueUSD = amount * price;
      finalTotalValue += valueUSD;
    }

    for (const [symbol] of Object.entries(config.targetAllocation)) {
      const amount = finalSymbolTotals[symbol] || 0;
      const price = prices.prices[symbol] || 0;
      const valueUSD = amount * price;
      finalAllocation[symbol] =
        finalTotalValue > 0 ? valueUSD / finalTotalValue : 0;
    }

    const totalSuccessfulTrades = allRebalancingResults.filter(
      (r) => r.success
    ).length;

    console.log(`\n🎯 === Rebalancing Complete ===`);
    console.log(`📊 Iterations completed: ${iterationsCompleted}`);
    console.log(`🔄 Total trades executed: ${totalSuccessfulTrades}`);
    console.log(`💰 Total volume: $${totalVolumeUSD.toFixed(2)}`);
    console.log(
      "🎯 Final allocation:",
      Object.fromEntries(
        Object.entries(finalAllocation).map(([k, v]) => [
          k,
          `${(v * 100).toFixed(1)}%`,
        ])
      )
    );

    return {
      rebalancingResults: allRebalancingResults,
      totalRebalancingTrades: totalSuccessfulTrades,
      totalRebalancingVolumeUSD: totalVolumeUSD,
      analysis,
      consolidationResults: inputData.consolidationResults,
      finalAllocation,
      iterationsCompleted,
    };
  },
});
