import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import {
  PriceDataSchema,
  ConfigSchema,
  PortfolioDataSchema,
  ChainAnalysisSchema,
  ChainAnalysisType,
} from "../types";
import { determineOptimalConsolidationChain } from "../utils";
import { recallTradingTools } from "../../../tools/recall-trading-tools";

/**
 * Step 2: Dynamically discover and analyze all portfolio tokens across chains with smart consolidation
 */
export const analyzeChainDistributionStep = createStep({
  id: "analyze-chain-distribution",
  description:
    "Dynamically discover all portfolio tokens, fetch prices, and analyze distribution with smart consolidation",
  inputSchema: z.object({
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  outputSchema: z.object({
    portfolio: PortfolioDataSchema,
    chainAnalysis: ChainAnalysisSchema,
    prices: PriceDataSchema,
    config: ConfigSchema,
  }),
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const { prices, config } = inputData;

    console.log(
      "💼 Fetching portfolio balances with dynamic token discovery..."
    );

    const portfolio = await recallTradingTools.getPortfolio.execute({
      context: {
        groupBySymbol: false, // Get detailed chain breakdown
        includeZeroBalances: false,
        includePricing: true, // Enable dynamic pricing for better rebalancing
      },
      mastra,
      runtimeContext,
    });

    console.log("🔍 Discovering and pricing all portfolio tokens...");

    // Discover all unique tokens in portfolio using getTokenInfoByAddress
    const discoveredTokens: Record<string, any> = {};
    const tokenSummary: Record<
      string,
      { totalAmount: number; totalValueUSD: number }
    > = {};

    for (const balance of portfolio.balances) {
      try {
        // Use getTokenInfoByAddress to get accurate token information and pricing
        const tokenInfo =
          await recallTradingTools.getTokenInfoByAddress.execute({
            context: {
              tokenAddress: balance.tokenAddress,
              chain: balance.chain as "evm" | "svm",
              specificChain: balance.specificChain as any,
            },
            mastra,
            runtimeContext,
          });

        if (tokenInfo.success && tokenInfo.price > 0) {
          const symbol = tokenInfo.symbol;
          const valueUSD = balance.amount * tokenInfo.price;

          // Store detailed token info
          discoveredTokens[balance.tokenAddress] = {
            symbol: tokenInfo.symbol,
            price: tokenInfo.price,
            chain: tokenInfo.chain,
            specificChain: tokenInfo.specificChain,
            address: balance.tokenAddress,
            amount: balance.amount,
            valueUSD,
          };

          // Aggregate by symbol for portfolio analysis
          if (!tokenSummary[symbol]) {
            tokenSummary[symbol] = { totalAmount: 0, totalValueUSD: 0 };
          }
          tokenSummary[symbol].totalAmount += balance.amount;
          tokenSummary[symbol].totalValueUSD += valueUSD;

          console.log(
            `💰 Discovered: ${balance.amount.toFixed(2)} ${symbol} = $${valueUSD.toFixed(2)} on ${tokenInfo.specificChain}`
          );
        } else {
          console.warn(
            `⚠️ Failed to get price info for token ${balance.tokenAddress} on ${balance.specificChain}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error discovering token ${balance.tokenAddress}:`,
          error
        );
      }
    }

    console.log("📊 Portfolio Token Summary:");
    Object.entries(tokenSummary).forEach(([symbol, data]) => {
      console.log(
        `  ${symbol}: ${data.totalAmount.toFixed(2)} tokens = $${data.totalValueUSD.toFixed(2)}`
      );
    });

    // Build enhanced portfolio data with discovered tokens
    const enhancedPortfolio = {
      ...portfolio,
      balances: portfolio.balances.map((balance) => {
        const tokenInfo = discoveredTokens[balance.tokenAddress];
        return {
          ...balance,
          price: tokenInfo?.price || 0,
          valueUSD: tokenInfo?.valueUSD || 0,
          discoveredSymbol: tokenInfo?.symbol || balance.symbol,
        };
      }),
    };

    // Continue with existing chain analysis logic
    console.log("🔗 Analyzing chain distribution...");
    console.log(
      `📋 Found ${enhancedPortfolio.balances.length} positions across chains`
    );

    // Analyze token distribution across chains
    const availableTokens: Record<string, string[]> = {};
    const tokenDistribution: Record<string, Record<string, number>> = {};
    const chainValues: Record<string, number> = {};

    // Initialize structures
    for (const chain of [
      "eth",
      "polygon",
      "base",
      "arbitrum",
      "optimism",
      "svm",
    ]) {
      availableTokens[chain] = [];
      chainValues[chain] = 0;
    }

    // Process each balance from enhanced portfolio
    for (const balance of enhancedPortfolio.balances) {
      const { symbol, specificChain, amount } = balance;
      const normalizedSymbol = symbol === "USDbC" ? "USDC" : symbol;

      // Track available tokens per chain
      if (!availableTokens[specificChain].includes(normalizedSymbol)) {
        availableTokens[specificChain].push(normalizedSymbol);
      }

      // Track token distribution
      if (!tokenDistribution[normalizedSymbol]) {
        tokenDistribution[normalizedSymbol] = {};
      }
      tokenDistribution[normalizedSymbol][specificChain] =
        (tokenDistribution[normalizedSymbol][specificChain] || 0) + amount;

      // Calculate chain values using discovered token prices
      const price = balance.price || prices.prices[normalizedSymbol] || 0;
      chainValues[specificChain] += amount * price;
    }

    console.log("🌍 Available tokens per chain:", availableTokens);
    console.log("📊 Token distribution:", tokenDistribution);
    console.log(
      "💵 Chain values:",
      Object.fromEntries(
        Object.entries(chainValues).map(([k, v]) => [k, `$${v.toFixed(2)}`])
      )
    );

    // Smart consolidation chain selection
    let consolidateToChain = config.consolidateToChain;

    if (!config.skipConsolidation && !consolidateToChain) {
      // Auto-determine optimal consolidation chain
      consolidateToChain = determineOptimalConsolidationChain(
        chainValues,
        tokenDistribution,
        config.targetAllocation
      );

      if (consolidateToChain) {
        console.log(
          `🤖 Smart consolidation: Auto-selected ${consolidateToChain} as optimal chain`
        );
      }
    } else if (consolidateToChain) {
      console.log(
        `👤 User-selected consolidation chain: ${consolidateToChain}`
      );
    }

    // Create consolidation plan if needed
    let consolidationPlan: any[] = [];

    if (!config.skipConsolidation && consolidateToChain) {
      console.log(`🔄 Planning consolidation to ${consolidateToChain}...`);

      for (const [token, distribution] of Object.entries(tokenDistribution)) {
        for (const [chain, amount] of Object.entries(distribution)) {
          if (chain !== consolidateToChain && amount > 0) {
            const price = prices.prices[token] || 0;
            const valueUSD = amount * price;

            // Only consolidate if value is above minimum threshold
            if (valueUSD >= config.minTradeValueUSD) {
              consolidationPlan.push({
                fromChain: chain,
                toChain: consolidateToChain,
                token,
                amount,
                valueUSD,
              });
            }
          }
        }
      }

      // Sort by value (largest first)
      consolidationPlan.sort((a, b) => b.valueUSD - a.valueUSD);
      console.log(
        `📦 Consolidation plan: ${consolidationPlan.length} moves planned`
      );
    }

    const chainAnalysis: ChainAnalysisType = {
      availableTokens,
      tokenDistribution,
      chainValues,
      consolidationPlan:
        consolidationPlan.length > 0 ? consolidationPlan : undefined,
    };

    // Create updated config with the determined consolidation chain
    const updatedConfig = {
      ...config,
      consolidateToChain,
    };

    return {
      portfolio: enhancedPortfolio,
      chainAnalysis,
      prices,
      config: updatedConfig,
    };
  },
});
