import {
  SPESIFIC_CHAIN_TOKENS,
  CHAIN_TYPE_MAP,
  DEFAULT_CHAIN_FOR_SYMBOL,
} from "../../../constants";
import {
  TokenInfo,
  BalanceEntry,
  SupportedToken,
  SupportedChain,
  SYMBOL_VARIANTS,
} from "./types";

// ============================================================================
// TOKEN UTILITY FUNCTIONS
// ============================================================================

/**
 * Get token information including address, chain type, and specific chain
 */
export function getTokenInfo(
  symbol: SupportedToken,
  specificChain?: SupportedChain
): TokenInfo {
  // Handle SOL (Solana native token)
  if (symbol === "SOL") {
    return {
      address: SPESIFIC_CHAIN_TOKENS.svm.sol,
      chain: "svm",
      specificChain: specificChain || "svm",
      symbol: "SOL",
    };
  }

  // For EVM tokens, determine the target chain
  const defaultChain =
    (DEFAULT_CHAIN_FOR_SYMBOL[symbol] as SupportedChain) || "eth";
  const targetChain = specificChain || defaultChain;

  // Get token key (WETH -> eth, USDT -> usdt, etc.)
  const tokenKey = symbol.toLowerCase().replace("w", "");

  // Get token address from constants with proper type checking
  const chainTokens =
    SPESIFIC_CHAIN_TOKENS[targetChain as keyof typeof SPESIFIC_CHAIN_TOKENS];
  if (!chainTokens) {
    throw new Error(`Chain ${targetChain} not supported`);
  }

  // Type-safe token address lookup
  let address: string;
  if (targetChain === "svm") {
    // SVM only has sol, usdc, usdt
    if (tokenKey === "usdc" || tokenKey === "usdt") {
      address = (chainTokens as any)[tokenKey];
    } else {
      throw new Error(`Token ${symbol} not supported on SVM chain`);
    }
  } else {
    // EVM chains have eth, usdc, usdt
    if (tokenKey === "eth" || tokenKey === "usdc" || tokenKey === "usdt") {
      address = (chainTokens as any)[tokenKey];
    } else {
      throw new Error(`Token ${symbol} not supported on chain ${targetChain}`);
    }
  }

  if (!address) {
    throw new Error(
      `Token ${symbol} address not found for chain ${targetChain}`
    );
  }

  return {
    address,
    chain: CHAIN_TYPE_MAP[targetChain] as "evm" | "svm",
    specificChain: targetChain,
    symbol,
  };
}

/**
 * Find balance for a specific token on a specific chain
 */
export function findBalanceForToken(
  balances: BalanceEntry[],
  tokenInfo: TokenInfo
): BalanceEntry | null {
  // First try exact address and chain match
  const exactMatch = balances.find(
    (balance) =>
      balance.tokenAddress.toLowerCase() === tokenInfo.address.toLowerCase() &&
      balance.specificChain === tokenInfo.specificChain
  );

  if (exactMatch) return exactMatch;

  // Fallback: try symbol and chain match (handles variants like USDbC)
  const symbolMatch = balances.find((balance) => {
    const normalizedSymbol = SYMBOL_VARIANTS[balance.symbol] || balance.symbol;
    return (
      normalizedSymbol === tokenInfo.symbol &&
      balance.specificChain === tokenInfo.specificChain
    );
  });

  return symbolMatch || null;
}
