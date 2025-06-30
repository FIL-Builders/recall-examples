import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PriceDataSchema,
  ConfigSchema,
  PortfolioDataSchema,
  ChainAnalysisSchema,
  TradeExecutionSchema,
} from "../types";
import { recallTradingTools } from "../../../tools/recall-trading";

/**
 * Step 3: Execute chain consolidation (if needed)
 */
export const executeConsolidationStep = createStep({
  id: "execute-consolidation",
  description: "Consolidate tokens to target chain before rebalancing",
  inputSchema: z.object({
    portfolio: PortfolioDataSchema,
    chainAnalysis: ChainAnalysisSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  outputSchema: z.object({
    consolidationResults: z.array(TradeExecutionSchema),
    updatedPortfolio: PortfolioDataSchema,
    chainAnalysis: ChainAnalysisSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const { chainAnalysis, config, prices } = inputData;
    let { portfolio } = inputData;

    const consolidationResults: any[] = [];

    if (!chainAnalysis.consolidationPlan || config.skipConsolidation) {
      console.log("⏭️ Skipping consolidation step");
      return {
        consolidationResults: [],
        updatedPortfolio: portfolio,
        chainAnalysis,
        prices,
        config,
      };
    }

    console.log(
      `🔄 Executing consolidation to ${config.consolidateToChain}...`
    );

    for (const move of chainAnalysis.consolidationPlan) {
      try {
        console.log(
          `🚚 Moving ${move.amount.toFixed(6)} ${move.token} from ${move.fromChain} to ${move.toChain} ($${move.valueUSD.toFixed(2)})`
        );

        // For cross-chain moves, we need to convert through a bridge token (typically USDC)
        // If the token IS USDC, we can do a direct cross-chain transfer
        // If it's not USDC, we sell to USDC on source chain, then buy the token on target chain

        if (move.token === "USDC") {
          // For USDC cross-chain moves, we'll simulate bridge transfer by keeping it as USDC
          console.log(
            `💱 USDC cross-chain move: ${move.amount.toFixed(6)} USDC from ${move.fromChain} to ${move.toChain}`
          );

          // Mark as successful cross-chain transfer (in real implementation, this would use a bridge)
          consolidationResults.push({
            success: true,
            status: "simulated_bridge_transfer",
            message: `Simulated USDC bridge transfer from ${move.fromChain} to ${move.toChain}`,
            txHash: `bridge_${Date.now()}`,
          });
        } else {
          // Handle large trades by splitting them if they exceed portfolio limits
          const maxTradeValue = move.valueUSD * 0.2; // Use 20% of position value max per trade
          const totalValue = Object.values(chainAnalysis.chainValues).reduce(
            (sum: number, val: number) => sum + val,
            0
          );
          const portfolioLimit = totalValue * 0.25; // 25% portfolio limit

          const effectiveMaxTrade = Math.min(
            maxTradeValue,
            portfolioLimit,
            move.valueUSD
          );
          const tradesToExecute = Math.ceil(move.valueUSD / effectiveMaxTrade);

          console.log(
            `🔀 Large ${move.token} position: splitting into ${tradesToExecute} trades (max $${effectiveMaxTrade.toFixed(2)} each)`
          );

          for (let i = 0; i < tradesToExecute; i++) {
            const isLastTrade = i === tradesToExecute - 1;
            const tradeAmount = isLastTrade
              ? move.amount - (i * move.amount) / tradesToExecute // Remaining amount
              : move.amount / tradesToExecute;

            console.log(
              `🚚 Sub-trade ${i + 1}/${tradesToExecute}: selling ${tradeAmount.toFixed(6)} ${move.token} on ${move.fromChain}`
            );

            // Step 1: Sell portion of token to USDC on source chain
            const sellResult = await recallTradingTools.executeTrade.execute({
              context: {
                fromSymbol: move.token as any,
                toSymbol: "USDC",
                amount: tradeAmount,
                reason: `Chain consolidation: selling ${move.token} on ${move.fromChain} (trade ${i + 1}/${tradesToExecute})`,
                slippageTolerance: config.maxSlippage,
                fromSpecificChain: move.fromChain as any,
                toSpecificChain: move.fromChain as any,
              },
              mastra,
              runtimeContext,
            });

            consolidationResults.push(sellResult);

            if (sellResult.success) {
              console.log(
                `✅ Successfully sold ${move.token} sub-trade ${i + 1}/${tradesToExecute}`
              );

              // Add delay between trades
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } else {
              console.log(
                `❌ Failed to sell ${move.token} sub-trade ${i + 1}/${tradesToExecute}: ${sellResult.message || "Unknown error"}`
              );
              // Continue with next sub-trade even if one fails
            }
          }

          // For cross-chain moves, we'll keep the USDC on the source chain
          // and let the rebalancing step handle purchasing the target token on the target chain
          console.log(
            `📋 ${move.token} consolidation complete - USDC ready for rebalancing step`
          );
        }

        // Add delay between major moves
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Error during consolidation move:`, error);
        consolidationResults.push({
          success: false,
          status: "error",
          message: `Consolidation failed: ${error}`,
        });
      }
    }

    // Fetch updated portfolio after consolidation
    console.log("🔄 Fetching updated portfolio after consolidation...");
    const updatedPortfolio = await recallTradingTools.getPortfolio.execute({
      context: {
        groupBySymbol: false,
        includeZeroBalances: false,
        includePricing: true, // Enable dynamic pricing for updated portfolio analysis
      },
      mastra,
      runtimeContext,
    });

    const successfulMoves = consolidationResults.filter(
      (r) => r.success
    ).length;
    console.log(
      `📦 Consolidation complete: ${successfulMoves}/${consolidationResults.length} moves successful`
    );

    return {
      consolidationResults,
      updatedPortfolio,
      chainAnalysis,
      prices,
      config,
    };
  },
});
