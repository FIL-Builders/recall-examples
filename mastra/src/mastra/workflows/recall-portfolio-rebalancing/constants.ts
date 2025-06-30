// ============================================================================
// TRADING CONFIGURATION CONSTANTS
// ============================================================================

// Default allocation - can be overridden via input
export const DEFAULT_TARGET_ALLOCATION = {
  USDC: 0, // 0% stable coin
  WETH: 0.0, // 0% ETH
  USDT: 1.0, // 100% stable coin alternative
  SOL: 0.0, // 0% SOL for diversification
} as const;

export const DEFAULT_REBALANCE_THRESHOLD = 0.001; // 0.1% drift triggers rebalancing
export const DEFAULT_MIN_TRADE_VALUE_USD = 0.01; // Minimum trade value in USD
export const DEFAULT_MAX_SLIPPAGE = "2.0"; // 2% max slippage
export const MAX_TRADE_SIZE_PERCENT = 0.25; // Maximum 25% of total portfolio per trade
export const SUB_TRADE_DELAY_MS = 3000; // 3 second delay between sub-trades

// ============================================================================
// CHAIN PREFERENCES
// ============================================================================

// Chain priorities for each token (preferred chains for holding)
export const CHAIN_PREFERENCES = {
  USDC: ["eth", "arbitrum", "polygon", "base", "optimism", "svm"],
  WETH: ["eth", "arbitrum", "optimism", "polygon", "base"],
  USDT: ["eth", "arbitrum", "polygon", "optimism", "base", "svm"],
  SOL: ["svm"],
} as const;

// ============================================================================
// REBALANCING CONFIGURATION
// ============================================================================

export const REBALANCING_CONFIG = {
  maxIterations: 10, // Prevent infinite loops
  convergenceThreshold: 0.005, // 0.5% - tighter than default for completion
  maxTradesPerIteration: 3, // Limit trades per iteration for safety
} as const;
