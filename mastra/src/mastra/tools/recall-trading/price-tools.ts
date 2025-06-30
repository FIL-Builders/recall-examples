import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { http } from "./http-client";
import { getTokenInfo } from "./utils";
import {
  SUPPORTED_TOKENS,
  SUPPORTED_CHAINS,
  TokenInfoResponse,
  TokenInfoSchema,
  PriceToolSchema,
} from "./types";

// ============================================================================
// PRICE TOOLS
// ============================================================================

/**
 * Get detailed token information including price from Recall Network API
 */
export const getTokenInfoByAddress = createTool({
  id: "getTokenInfoByAddress",
  description:
    "Get detailed token information including price and chain details using token address",
  inputSchema: z.object({
    tokenAddress: z.string().describe("Token contract address"),
    chain: z
      .enum(["evm", "svm"])
      .optional()
      .describe("Blockchain type of the token"),
    specificChain: z
      .enum([
        "eth",
        "polygon",
        "bsc",
        "arbitrum",
        "optimism",
        "avalanche",
        "base",
        "linea",
        "zksync",
        "scroll",
        "mantle",
        "svm",
      ])
      .optional()
      .describe("Specific chain for EVM tokens"),
  }),
  // Remove outputSchema to avoid structured content requirement
  execute: async ({ context }) => {
    try {
      console.log(
        `🔍 Fetching token info for address: ${context.tokenAddress}`
      );

      const response = await http.get(
        `${process.env.RECALL_API_URL}/api/price/token-info`,
        {
          params: {
            token: context.tokenAddress,
            ...(context.chain && { chain: context.chain }),
            ...(context.specificChain && {
              specificChain: context.specificChain,
            }),
          },
          timeout: 10000,
        }
      );

      const data: TokenInfoResponse = response.data;

      if (!data.success) {
        return {
          success: false,
          price: 0,
          token: context.tokenAddress,
          chain: "evm" as const,
          specificChain: "unknown",
          symbol: "UNKNOWN",
          error: "Failed to fetch token information",
        };
      }

      console.log(
        `💰 Token info: ${data.symbol} = $${data.price} on ${data.specificChain}`
      );

      return {
        success: data.success,
        price: data.price,
        token: data.token,
        chain: data.chain,
        specificChain: data.specificChain,
        symbol: data.symbol,
      };
    } catch (error: any) {
      console.error("Error fetching token info:", error);
      return {
        success: false,
        price: 0,
        token: context.tokenAddress,
        chain: "evm" as const,
        specificChain: "unknown",
        symbol: "UNKNOWN",
        error: `Failed to fetch token info: ${error.message}`,
      };
    }
  },
});

/**
 * Get current prices from Recall Network API with enhanced token discovery
 */
export const getPrice = createTool({
  id: "getPrice",
  description:
    "Get current price for crypto symbols from Recall Network API with cross-chain support and dynamic token discovery",
  inputSchema: z.object({
    symbols: z
      .array(z.enum(SUPPORTED_TOKENS))
      .describe("Array of symbols to get prices for"),
    specificChain: z
      .enum(SUPPORTED_CHAINS)
      .optional()
      .describe("Specific chain to get prices from (defaults based on token)"),
    tokenAddresses: z
      .array(z.string())
      .optional()
      .describe(
        "Optional array of token addresses for dynamic price discovery"
      ),
  }),
  // Remove outputSchema to avoid structured content requirement
  execute: async ({ context }) => {
    const prices: Record<string, number> = {};
    const tokenInfo: Record<string, any> = {};
    const errors: string[] = [];

    try {
      // Handle known symbols using existing logic
      for (const symbol of context.symbols) {
        try {
          const knownTokenInfo = getTokenInfo(symbol, context.specificChain);

          const response = await http.get(
            `${process.env.RECALL_API_URL}/api/price/token-info`,
            {
              params: {
                token: knownTokenInfo.address,
                chain: knownTokenInfo.chain,
                specificChain: knownTokenInfo.specificChain,
              },
              timeout: 10000,
            }
          );

          const data: TokenInfoResponse = response.data;
          if (data.success && typeof data.price === "number") {
            prices[symbol] = data.price;
            tokenInfo[symbol] = {
              symbol: data.symbol,
              chain: data.chain,
              specificChain: data.specificChain,
              address: data.token,
            };
          } else {
            errors.push(`Invalid price data for ${symbol}`);
          }
        } catch (error: any) {
          const errorMsg = `Failed to fetch price for ${symbol}: ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Handle dynamic token addresses if provided
      if (context.tokenAddresses) {
        for (const address of context.tokenAddresses) {
          try {
            const response = await http.get(
              `${process.env.RECALL_API_URL}/api/price/token-info`,
              {
                params: {
                  token: address,
                  ...(context.specificChain && {
                    specificChain: context.specificChain,
                  }),
                },
                timeout: 10000,
              }
            );

            const data: TokenInfoResponse = response.data;
            if (data.success && typeof data.price === "number") {
              const key = data.symbol || address.slice(0, 8);
              prices[key] = data.price;
              tokenInfo[key] = {
                symbol: data.symbol,
                chain: data.chain,
                specificChain: data.specificChain,
                address: data.token,
              };
            } else {
              errors.push(`Invalid price data for token ${address}`);
            }
          } catch (error: any) {
            const errorMsg = `Failed to fetch price for token ${address}: ${error.message}`;
            console.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      return {
        success: errors.length === 0,
        prices,
        tokenInfo: Object.keys(tokenInfo).length > 0 ? tokenInfo : undefined,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      console.error("Error in getPrice:", error);
      return {
        success: false,
        prices: {},
        errors: [`General error: ${error.message}`],
      };
    }
  },
});
