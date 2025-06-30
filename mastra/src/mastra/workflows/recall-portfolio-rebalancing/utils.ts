import {
  ChainAnalysisType,
  TradeParams,
  SubTradeParams,
  TradeExecutionResult,
  ConfigType,
  PortfolioDataType,
  PriceDataType,
  TokenType,
} from "./types";
import {
  MAX_TRADE_SIZE_PERCENT,
  SUB_TRADE_DELAY_MS,
  CHAIN_PREFERENCES,
} from "./constants";
import { recallTradingTools, getTokenInfo } from "../../tools/recall-trading";

// ============================================================================
// TRADE EXECUTION UTILITIES
// ============================================================================

/**
 * Split large trades into smaller sub-trades to respect maximum trade size limit
 */
export function splitTradeIntoSubTrades(
  trade: TradeParams,
  totalPortfolioValueUSD: number,
  maxTradePercent: number = MAX_TRADE_SIZE_PERCENT
): SubTradeParams[] {
  // Validate inputs
  if (
    !totalPortfolioValueUSD ||
    totalPortfolioValueUSD <= 0 ||
    !maxTradePercent ||
    maxTradePercent <= 0
  ) {
    console.log(
      `⚠️ Invalid portfolio value (${totalPortfolioValueUSD}) or trade percent (${maxTradePercent}), returning single trade`
    );
    return [
      {
        ...trade,
        subTradeIndex: 1,
        totalSubTrades: 1,
      },
    ];
  }

  const maxTradeValueUSD = totalPortfolioValueUSD * maxTradePercent;

  // Additional validation
  if (
    !maxTradeValueUSD ||
    maxTradeValueUSD <= 0 ||
    !trade.differenceValueUSD ||
    trade.differenceValueUSD <= 0
  ) {
    console.log(
      `⚠️ Invalid max trade value (${maxTradeValueUSD}) or difference value (${trade.differenceValueUSD}), returning single trade`
    );
    return [
      {
        ...trade,
        subTradeIndex: 1,
        totalSubTrades: 1,
      },
    ];
  }

  // If trade is within limits, return as single trade
  if (trade.differenceValueUSD <= maxTradeValueUSD) {
    return [
      {
        ...trade,
        subTradeIndex: 1,
        totalSubTrades: 1,
      },
    ];
  }

  // Calculate number of sub-trades needed with safety checks
  const numberOfSubTrades = Math.max(
    1,
    Math.ceil(trade.differenceValueUSD / maxTradeValueUSD)
  );
  const subTradeValueUSD = trade.differenceValueUSD / numberOfSubTrades;
  const subTradeAmount = trade.differenceAmount / numberOfSubTrades;

  console.log(
    `🔀 Splitting large ${trade.action} trade: ${trade.symbol} $${trade.differenceValueUSD.toFixed(2)} → ${numberOfSubTrades} sub-trades of ~$${subTradeValueUSD.toFixed(2)} each`
  );

  // Create sub-trades
  const subTrades: SubTradeParams[] = [];
  for (let i = 0; i < numberOfSubTrades; i++) {
    subTrades.push({
      ...trade,
      differenceAmount: subTradeAmount,
      differenceValueUSD: subTradeValueUSD,
      subTradeIndex: i + 1,
      totalSubTrades: numberOfSubTrades,
    });
  }

  return subTrades;
}

/**
 * Execute a single trade (sell or buy) with proper error handling and balance management
 */
export async function executeSingleTrade(
  trade: SubTradeParams,
  tradeType: "sell" | "buy",
  portfolio: PortfolioDataType,
  config: ConfigType,
  analysis: any,
  mastra: any,
  runtimeContext: any,
  prices?: PriceDataType
): Promise<TradeExecutionResult> {
  try {
    const subTradeInfo =
      trade.totalSubTrades > 1
        ? ` [Sub-trade ${trade.subTradeIndex}/${trade.totalSubTrades}]`
        : "";

    if (tradeType === "sell") {
      console.log(
        `💸 Selling ${trade.differenceAmount.toFixed(6)} ${trade.symbol} ($${trade.differenceValueUSD.toFixed(2)})${subTradeInfo}`
      );

      // Find the best balance to sell from
      const tokenBalances = portfolio.balances.filter(
        (b: any) =>
          b.symbol === trade.symbol ||
          (b.symbol === "USDbC" && trade.symbol === "USDC")
      );

      if (tokenBalances.length === 0) {
        console.log(`❌ No ${trade.symbol} balance found`);
        return { result: null, success: false };
      }

      // If consolidating, prefer the target chain, otherwise use the largest balance
      let bestBalance;
      if (config.consolidateToChain) {
        bestBalance =
          tokenBalances.find(
            (b: any) => b.specificChain === config.consolidateToChain
          ) ||
          tokenBalances.reduce((max: any, current: any) =>
            current.amount > max.amount ? current : max
          );
      } else {
        bestBalance = tokenBalances.reduce((max: any, current: any) =>
          current.amount > max.amount ? current : max
        );
      }

      const tradeAmount = Math.min(trade.differenceAmount, bestBalance.amount);

      // For sell trades, we need to determine what to sell TO
      // If selling USDC (non-target token), sell to the target token instead
      let toSymbol: TokenType = "USDC";

      // Find the primary target token (highest allocation %)
      const targetAllocation =
        config.targetAllocation || analysis.targetAllocation;
      const primaryTargetToken = Object.entries(targetAllocation)
        .filter(([_, percent]) => (percent as number) > 0)
        .sort(([_, a], [__, b]) => (b as number) - (a as number))[0];

      if (primaryTargetToken && trade.symbol === "USDC") {
        // If selling USDC and we have a target token, sell directly to target
        toSymbol = primaryTargetToken[0] as TokenType;
        console.log(
          `📈 Converting ${trade.symbol} directly to target token ${toSymbol}`
        );
      } else if (trade.symbol !== "USDC") {
        // If selling non-USDC token, convert to USDC first
        toSymbol = "USDC";
      } else {
        // Safety fallback - if selling USDC and no clear target, skip this trade
        console.log(`⚠️ Skipping USDC→USDC trade (invalid)`);
        return { result: null, success: false };
      }

      const result = await recallTradingTools.executeTrade.execute({
        context: {
          fromSymbol: trade.symbol,
          toSymbol: toSymbol,
          amount: tradeAmount,
          reason: `Smart rebalancing: reducing ${trade.symbol} allocation${subTradeInfo}`,
          slippageTolerance: config.maxSlippage,
          fromSpecificChain: bestBalance.specificChain as any,
          toSpecificChain: trade.preferredChain as any,
        },
        mastra,
        runtimeContext,
      });

      if (result.success) {
        console.log(`✅ Successfully sold ${trade.symbol}${subTradeInfo}`);
      }

      return { result, success: result.success };
    } else {
      // Buy trade
      console.log(
        `🛒 Buying ${trade.differenceAmount.toFixed(6)} ${trade.symbol} ($${trade.differenceValueUSD.toFixed(2)})${subTradeInfo}`
      );

      // Find all stablecoin balances (USDC, USDbC, DAI, USDT) to use for buying
      const stablecoinBalances = portfolio.balances.filter(
        (b: any) =>
          ["USDC", "USDbC", "DAI", "USDT"].includes(b.symbol) && b.amount > 0
      );

      if (stablecoinBalances.length === 0) {
        console.log("❌ No stablecoin balance found for buying");
        console.log(
          "💡 Available balances:",
          portfolio.balances.map(
            (b: any) =>
              `${b.amount.toFixed(4)} ${b.symbol} on ${b.specificChain}`
          )
        );
        return { result: null, success: false };
      }

      // Sort by balance size (largest first) to use the biggest stablecoin balance
      stablecoinBalances.sort((a: any, b: any) => {
        const aValue =
          a.amount *
          (prices?.prices[a.symbol === "USDbC" ? "USDC" : a.symbol] || 1);
        const bValue =
          b.amount *
          (prices?.prices[b.symbol === "USDbC" ? "USDC" : b.symbol] || 1);
        return bValue - aValue;
      });

      // Find the best stablecoin balance that can cover this trade
      let bestStablecoinBalance = null;
      for (const balance of stablecoinBalances) {
        const price =
          prices?.prices[
            balance.symbol === "USDbC" ? "USDC" : balance.symbol
          ] || 1;
        const valueUSD = balance.amount * price;

        if (valueUSD >= trade.differenceValueUSD) {
          bestStablecoinBalance = balance;
          break;
        }
      }

      // If no single balance can cover it, use the largest one
      if (!bestStablecoinBalance) {
        bestStablecoinBalance = stablecoinBalances[0];
      }

      console.log(
        `💰 Using ${bestStablecoinBalance.amount.toFixed(2)} ${bestStablecoinBalance.symbol} on ${bestStablecoinBalance.specificChain} to buy ${trade.symbol}`
      );

      // Calculate the actual available value and adjust trade size if needed
      const availablePrice =
        prices?.prices[
          bestStablecoinBalance.symbol === "USDbC"
            ? "USDC"
            : bestStablecoinBalance.symbol
        ] || 1;
      const availableValueUSD = bestStablecoinBalance.amount * availablePrice;
      const actualTradeAmount = Math.min(
        trade.differenceValueUSD,
        availableValueUSD
      );

      // Get the target token address
      const targetTokenInfo = getTokenInfo(
        trade.symbol,
        trade.preferredChain as any
      );

      // Use executeTradeByAddress for tokens that aren't in the standard supported list (like DAI)
      // or when we need more flexibility
      const isStandardToken = ["USDC", "WETH", "USDT", "SOL"].includes(
        bestStablecoinBalance.symbol
      );

      let result;
      if (isStandardToken && bestStablecoinBalance.symbol !== "USDbC") {
        // Use standard trade for supported tokens
        result = await recallTradingTools.executeTrade.execute({
          context: {
            fromSymbol: bestStablecoinBalance.symbol as TokenType,
            toSymbol: trade.symbol,
            amount: actualTradeAmount,
            reason: `Smart rebalancing: increasing ${trade.symbol} allocation${subTradeInfo}`,
            slippageTolerance: config.maxSlippage,
            fromSpecificChain: bestStablecoinBalance.specificChain as any,
            toSpecificChain: trade.preferredChain as any,
          },
          mastra,
          runtimeContext,
        });
      } else {
        // Use address-based trade for non-standard tokens (DAI, USDbC, etc.)
        result = await recallTradingTools.executeTradeByAddress.execute({
          context: {
            fromTokenAddress: bestStablecoinBalance.tokenAddress,
            toTokenAddress: targetTokenInfo.address,
            amount: actualTradeAmount,
            reason: `Smart rebalancing: increasing ${trade.symbol} allocation${subTradeInfo}`,
            slippageTolerance: config.maxSlippage,
            fromChain: bestStablecoinBalance.chain as "evm" | "svm",
            fromSpecificChain: bestStablecoinBalance.specificChain as any,
            toChain: targetTokenInfo.chain as "evm" | "svm",
            toSpecificChain: trade.preferredChain as any,
          },
          mastra,
          runtimeContext,
        });
      }

      if (result.success) {
        console.log(`✅ Successfully bought ${trade.symbol}${subTradeInfo}`);
      } else {
        console.log(
          `❌ Failed to buy ${trade.symbol}${subTradeInfo}: ${result.message || "Unknown error"}`
        );
      }

      return { result, success: result.success };
    }
  } catch (error) {
    console.error(`❌ ${tradeType} trade error:`, error);
    return { result: null, success: false };
  }
}

// ============================================================================
// CHAIN ANALYSIS UTILITIES
// ============================================================================

/**
 * Automatically determine the best consolidation chain based on portfolio distribution
 */
export function determineOptimalConsolidationChain(
  chainValues: Record<string, number>,
  tokenDistribution: Record<string, Record<string, number>>,
  targetAllocation: Record<string, number>
): string | undefined {
  // If no tokens need consolidation, skip
  const totalChains = Object.keys(chainValues).filter(
    (chain) => chainValues[chain] > 0
  ).length;
  if (totalChains <= 1) {
    console.log("💡 Portfolio already consolidated to single chain");
    return undefined;
  }

  // Strategy 1: Find the chain with the highest total value
  const chainsByValue = Object.entries(chainValues)
    .filter(([_, value]) => value > 0)
    .sort(([_, a], [__, b]) => b - a);

  if (chainsByValue.length === 0) return undefined;

  const [highestValueChain, highestValue] = chainsByValue[0];

  // Strategy 2: Consider target allocation preferences
  const targetTokens = Object.entries(targetAllocation)
    .filter(([_, percent]) => percent > 0)
    .map(([token, _]) => token);

  // For each target token, check if the highest value chain supports it well
  let optimalChain = highestValueChain;
  let bestScore = 0;

  for (const [chain, value] of chainsByValue) {
    let score = value; // Base score is the value on this chain

    // Bonus points for supporting target tokens natively
    for (const token of targetTokens) {
      const preferences =
        CHAIN_PREFERENCES[token as keyof typeof CHAIN_PREFERENCES];
      if (preferences) {
        const chainIndex = preferences.findIndex(
          (preferredChain) => preferredChain === chain
        );
        if (chainIndex >= 0) {
          score += 1000 / (chainIndex + 1); // Higher score for more preferred chains
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      optimalChain = chain;
    }
  }

  console.log(
    `🎯 Auto-selected consolidation chain: ${optimalChain} (value: $${chainValues[optimalChain].toFixed(2)}, score: ${bestScore.toFixed(0)})`
  );
  return optimalChain;
}

// ============================================================================
// DELAY UTILITIES
// ============================================================================

/**
 * Create a delay between trades
 */
export async function createTradeDelay(
  ms: number = SUB_TRADE_DELAY_MS
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
