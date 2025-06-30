import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { http, createErrorResponse } from "./http-client";
import {
  SUPPORTED_CHAINS,
  SYMBOL_VARIANTS,
  PortfolioResponse,
  TokenInfoResponse,
  PortfolioToolSchema,
} from "./types";

// ============================================================================
// PORTFOLIO TOOLS
// ============================================================================

/**
 * Get portfolio balances with enhanced filtering, grouping, and dynamic pricing
 */
export const getPortfolio = createTool({
  id: "getPortfolio",
  description:
    "Get portfolio balances from Recall Network with advanced filtering, grouping, and dynamic token discovery with pricing",
  inputSchema: z.object({
    groupBySymbol: z
      .boolean()
      .optional()
      .default(false)
      .describe("Group balances by symbol across all chains"),
    filterByChain: z
      .enum(SUPPORTED_CHAINS)
      .optional()
      .describe("Filter balances by specific chain"),
    includeZeroBalances: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include tokens with zero balance"),
    includePricing: z
      .boolean()
      .optional()
      .default(false)
      .describe("Fetch current prices for all tokens in portfolio"),
  }),
  outputSchema: PortfolioToolSchema,
  execute: async ({ context }) => {
    try {
      const response = await http.get(
        `${process.env.RECALL_API_URL}/api/agent/balances`
      );
      const portfolioData: PortfolioResponse = response.data;

      let filteredBalances = portfolioData.balances;

      // Filter by chain if specified
      if (context.filterByChain) {
        filteredBalances = filteredBalances.filter(
          (balance) => balance.specificChain === context.filterByChain
        );
      }

      // Filter out zero balances if not requested
      if (!context.includeZeroBalances) {
        filteredBalances = filteredBalances.filter(
          (balance) => balance.amount > 0
        );
      }

      // Fetch pricing information if requested
      let pricing: Record<string, any> | undefined;
      let totalValue: number | undefined;

      if (context.includePricing) {
        pricing = {};
        totalValue = 0;

        console.log("🔍 Fetching prices for portfolio tokens...");

        // Get unique token addresses for pricing
        const uniqueTokens = [
          ...new Set(
            filteredBalances.map((b) => ({
              address: b.tokenAddress,
              chain: b.chain as "evm" | "svm",
              specificChain: b.specificChain,
            }))
          ),
        ];

        for (const token of uniqueTokens) {
          try {
            const priceResponse = await http.get(
              `${process.env.RECALL_API_URL}/api/price/token-info`,
              {
                params: {
                  token: token.address,
                  chain: token.chain,
                  specificChain: token.specificChain,
                },
                timeout: 10000,
              }
            );

            const priceData: TokenInfoResponse = priceResponse.data;
            if (priceData.success) {
              pricing[token.address] = {
                symbol: priceData.symbol,
                price: priceData.price,
                chain: priceData.chain,
                specificChain: priceData.specificChain,
              };
            }
          } catch (error) {
            console.warn(`Failed to fetch price for ${token.address}:`, error);
          }
        }

        // Add pricing and value information to balances
        filteredBalances = filteredBalances.map((balance) => {
          const tokenPricing = pricing![balance.tokenAddress];
          if (tokenPricing) {
            const valueUSD = balance.amount * tokenPricing.price;
            totalValue! += valueUSD;
            return {
              ...balance,
              price: tokenPricing.price,
              valueUSD,
            };
          }
          return balance;
        });
      }

      // Create summary by symbol if requested
      let summary: Record<string, number> | undefined;
      if (context.groupBySymbol) {
        summary = {};
        filteredBalances.forEach((balance) => {
          const normalizedSymbol =
            SYMBOL_VARIANTS[balance.symbol] || balance.symbol;
          summary![normalizedSymbol] =
            (summary![normalizedSymbol] || 0) + balance.amount;
        });
      }

      return {
        success: true,
        agentId: portfolioData.agentId,
        balances: filteredBalances,
        summary,
        pricing,
        totalValue,
      };
    } catch (error: any) {
      console.error("Error fetching portfolio:", error);
      return createErrorResponse(
        "fetch_error",
        `Failed to fetch portfolio: ${error.message}`,
        { success: false, agentId: "", balances: [] }
      );
    }
  },
});
