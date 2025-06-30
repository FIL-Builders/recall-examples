// constants.ts
export const SYMBOL = "RECALL_USD";
export const INTERVAL_MIN = 15;
export const SMA_WINDOW = (24 * 60) / INTERVAL_MIN; // 96
export const POSITION_CAP = 0.1; // 10 %
export const QUOTA_CHECK_UTC = "23:45";

export const SPESIFIC_CHAIN_TOKENS = {
  eth: {
    eth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH on Ethereum
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT on Ethereum
  },
  polygon: {
    eth: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Weth on Polygon
    usdc: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
    usdt: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT on Polygon
  },
  base: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Base
    usdc: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", // USDbC on Base
    usdt: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // USDT on Base
  },
  svm: {
    sol: "So11111111111111111111111111111111111111112",
    usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    usdt: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
  arbitrum: {
    eth: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH on Arbitrum
    usdc: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Native USDC on Arbitrum
    usdt: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT on Arbitrum
  },
  optimism: {
    eth: "0x4200000000000000000000000000000000000006", // WETH on Optimism
    usdc: "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC on Optimism
    usdt: "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT on Optimism
  },
};

// Chain type mapping for Recall Network API
export const CHAIN_TYPE_MAP = {
  eth: "evm",
  polygon: "evm",
  base: "evm",
  arbitrum: "evm",
  optimism: "evm",
  svm: "svm",
};

// Default chain for each symbol (for simplicity)
export const DEFAULT_CHAIN_FOR_SYMBOL = {
  WETH: "eth",
  USDC: "eth",
  USDT: "eth",
  SOL: "svm",
};
