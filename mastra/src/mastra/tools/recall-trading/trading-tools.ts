import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { http, createErrorResponse } from "./http-client";
import { getTokenInfo, findBalanceForToken } from "./utils";
import {
  SUPPORTED_TOKENS,
  SUPPORTED_CHAINS,
  PortfolioResponse,
  TradeExecutionToolSchema,
} from "./types";

// ============================================================================
// TRADING TOOLS
// ============================================================================

/**
 * Execute a cross-chain trade using token addresses for maximum flexibility
 */
export const executeTradeByAddress = createTool({
  id: "executeTradeByAddress",
  description:
    "Execute a cross-chain trade using token addresses with balance validation and enhanced error handling",
  inputSchema: z.object({
    fromTokenAddress: z.string().describe("Address of token to trade from"),
    toTokenAddress: z.string().describe("Address of token to trade to"),
    amount: z.number().positive().describe("Amount in whole tokens"),
    reason: z
      .string()
      .min(10)
      .describe("Detailed reason for the trade (required for competition)"),
    slippageTolerance: z
      .string()
      .optional()
      .default("0.5")
      .describe("Slippage tolerance percentage (default: 0.5%)"),
    fromChain: z.enum(["evm", "svm"]).describe("Chain type for from token"),
    fromSpecificChain: z
      .enum(SUPPORTED_CHAINS)
      .describe("Specific chain for the from token"),
    toChain: z.enum(["evm", "svm"]).describe("Chain type for to token"),
    toSpecificChain: z
      .enum(SUPPORTED_CHAINS)
      .describe("Specific chain for the to token"),
  }),
  // Remove outputSchema to avoid structured content requirement
  execute: async ({ context }) => {
    try {
      // Validate that we're not trading the same token
      if (
        context.fromTokenAddress.toLowerCase() ===
          context.toTokenAddress.toLowerCase() &&
        context.fromSpecificChain === context.toSpecificChain
      ) {
        return createErrorResponse(
          "invalid_trade",
          "Cannot trade the same token on the same chain",
          { success: false }
        );
      }

      // Fetch current portfolio
      const portfolioResponse = await http.get(
        `${process.env.RECALL_API_URL}/api/agent/balances`
      );
      const portfolioData: PortfolioResponse = portfolioResponse.data;

      // Find the relevant balance by address and chain
      const selectedBalance = portfolioData.balances.find(
        (balance) =>
          balance.tokenAddress.toLowerCase() ===
            context.fromTokenAddress.toLowerCase() &&
          balance.specificChain === context.fromSpecificChain
      );

      const availableBalance = selectedBalance ? selectedBalance.amount : 0;
      const sufficientBalance = availableBalance >= context.amount;

      // Create balance check info
      const balanceCheck = {
        availableBalance,
        requestedAmount: context.amount,
        sufficient: sufficientBalance,
        tokenInfo: {
          address: context.fromTokenAddress,
          chain: context.fromChain,
          specificChain: context.fromSpecificChain,
        },
      };

      // Check balance sufficiency
      if (!sufficientBalance) {
        return {
          success: false,
          status: "insufficient_balance",
          message: `Insufficient balance on ${context.fromSpecificChain}. Available: ${availableBalance}, Requested: ${context.amount}`,
          balanceCheck,
        };
      }

      // Prepare trade payload
      const tradePayload = {
        fromToken: context.fromTokenAddress,
        toToken: context.toTokenAddress,
        amount: context.amount.toString(),
        reason: context.reason,
        slippageTolerance: context.slippageTolerance,
        fromChain: context.fromChain,
        fromSpecificChain: context.fromSpecificChain,
        toChain: context.toChain,
        toSpecificChain: context.toSpecificChain,
      };

      console.log("Executing trade by address with payload:", tradePayload);

      // Execute the trade
      const tradeResponse = await http.post(
        `${process.env.RECALL_API_URL}/api/trade/execute`,
        tradePayload
      );

      return {
        success: true,
        status: "executed",
        message: `Successfully executed trade: ${context.amount} tokens from ${context.fromTokenAddress} -> ${context.toTokenAddress}`,
        txHash: tradeResponse.data.txHash,
        balanceCheck,
        tradeDetails: {
          fromToken: context.fromTokenAddress,
          toToken: context.toTokenAddress,
          fromChain: `${context.fromChain}:${context.fromSpecificChain}`,
          toChain: `${context.toChain}:${context.toSpecificChain}`,
        },
        ...tradeResponse.data,
      };
    } catch (error: any) {
      console.error("Error executing trade by address:", error);

      // Handle specific API errors
      if (error.response?.status === 400) {
        return createErrorResponse(
          "bad_request",
          `Trade execution failed: ${error.response.data?.message || error.message}`,
          { success: false }
        );
      }

      if (error.response?.status === 429) {
        return createErrorResponse(
          "rate_limited",
          "Rate limit exceeded. Please try again later.",
          { success: false }
        );
      }

      if (error.response?.status === 401) {
        return createErrorResponse(
          "unauthorized",
          "Invalid API key or authorization failed",
          { success: false }
        );
      }

      // Generic error
      return createErrorResponse(
        "execution_error",
        `Failed to execute trade: ${error.message || "Unknown error"}`,
        { success: false }
      );
    }
  },
});

/**
 * Execute a cross-chain trade with comprehensive validation
 */
export const executeTrade = createTool({
  id: "executeTrade",
  description:
    "Execute a cross-chain trade with balance validation and enhanced error handling",
  inputSchema: z.object({
    fromSymbol: z.enum(SUPPORTED_TOKENS).describe("Symbol to trade from"),
    toSymbol: z.enum(SUPPORTED_TOKENS).describe("Symbol to trade to"),
    amount: z.number().positive().describe("Amount in whole tokens"),
    reason: z
      .string()
      .min(10)
      .describe("Detailed reason for the trade (required for competition)"),
    slippageTolerance: z
      .string()
      .optional()
      .default("0.5")
      .describe("Slippage tolerance percentage (default: 0.5%)"),
    fromSpecificChain: z
      .enum(SUPPORTED_CHAINS)
      .optional()
      .describe("Specific chain for the from token"),
    toSpecificChain: z
      .enum(SUPPORTED_CHAINS)
      .optional()
      .describe("Specific chain for the to token"),
  }),
  // Remove outputSchema to avoid structured content requirement
  execute: async ({ context }) => {
    try {
      // Validate that we're not trading the same token
      if (
        context.fromSymbol === context.toSymbol &&
        context.fromSpecificChain === context.toSpecificChain
      ) {
        return createErrorResponse(
          "invalid_trade",
          "Cannot trade the same token on the same chain",
          { success: false }
        );
      }

      // Get token information for both sides of the trade
      const fromTokenInfo = getTokenInfo(
        context.fromSymbol,
        context.fromSpecificChain
      );
      const toTokenInfo = getTokenInfo(
        context.toSymbol,
        context.toSpecificChain
      );

      // Fetch current portfolio
      const portfolioResponse = await http.get(
        `${process.env.RECALL_API_URL}/api/agent/balances`
      );
      const portfolioData: PortfolioResponse = portfolioResponse.data;

      // Find the relevant balance
      const selectedBalance = findBalanceForToken(
        portfolioData.balances,
        fromTokenInfo
      );
      const availableBalance = selectedBalance ? selectedBalance.amount : 0;
      const sufficientBalance = availableBalance >= context.amount;

      // Create balance check info
      const balanceCheck = {
        availableBalance,
        requestedAmount: context.amount,
        sufficient: sufficientBalance,
        tokenInfo: {
          address: fromTokenInfo.address,
          chain: fromTokenInfo.chain,
          specificChain: fromTokenInfo.specificChain,
        },
      };

      // Check balance sufficiency
      if (!sufficientBalance) {
        return {
          success: false,
          status: "insufficient_balance",
          message: `Insufficient ${context.fromSymbol} balance on ${fromTokenInfo.specificChain}. Available: ${availableBalance}, Requested: ${context.amount}`,
          balanceCheck,
        };
      }

      // Prepare trade payload
      const tradePayload = {
        fromToken: fromTokenInfo.address,
        toToken: toTokenInfo.address,
        amount: context.amount.toString(),
        reason: context.reason,
        slippageTolerance: context.slippageTolerance,
        fromChain: fromTokenInfo.chain,
        fromSpecificChain: fromTokenInfo.specificChain,
        toChain: toTokenInfo.chain,
        toSpecificChain: toTokenInfo.specificChain,
      };

      console.log("Executing trade with payload:", tradePayload);

      // Execute the trade
      const tradeResponse = await http.post(
        `${process.env.RECALL_API_URL}/api/trade/execute`,
        tradePayload
      );

      return {
        success: true,
        status: "executed",
        message: `Successfully executed trade: ${context.amount} ${context.fromSymbol} -> ${context.toSymbol}`,
        txHash: tradeResponse.data.txHash,
        balanceCheck,
        tradeDetails: {
          fromToken: fromTokenInfo.address,
          toToken: toTokenInfo.address,
          fromChain: `${fromTokenInfo.chain}:${fromTokenInfo.specificChain}`,
          toChain: `${toTokenInfo.chain}:${toTokenInfo.specificChain}`,
        },
        ...tradeResponse.data,
      };
    } catch (error: any) {
      console.error("Error executing trade:", error);

      // Handle specific API errors
      if (error.response?.status === 400) {
        return createErrorResponse(
          "bad_request",
          `Trade execution failed: ${error.response.data?.message || error.message}`,
          { success: false }
        );
      }

      if (error.response?.status === 429) {
        return createErrorResponse(
          "rate_limited",
          "Rate limit exceeded. Please try again later.",
          { success: false }
        );
      }

      if (error.response?.status === 401) {
        return createErrorResponse(
          "unauthorized",
          "Invalid API key or authorization failed",
          { success: false }
        );
      }

      // Generic error
      return createErrorResponse(
        "execution_error",
        `Failed to execute trade: ${error.message || "Unknown error"}`,
        { success: false }
      );
    }
  },
});
