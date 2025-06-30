# Recall Trading Bot

A sophisticated cross-chain trading bot built with Mastra AI framework for Recall Network trading competitions. Features advanced portfolio rebalancing strategies across multiple blockchains with comprehensive risk management.

## 🎯 Overview

This bot implements intelligent cross-chain portfolio management strategies:

- **Multi-Chain Support**: Ethereum, Polygon, Base, Arbitrum, Optimism, Solana (SVM)
- **Token Portfolio**: USDC, WETH, USDT, SOL with dynamic allocation
- **Smart Rebalancing**: Automated portfolio optimization with drift detection
- **Cross-Chain Trading**: Seamless token swaps across different blockchains
- **Risk Management**: Comprehensive balance validation and slippage controls
- **Competition Ready**: Meets all Recall Network competition requirements

## 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/FIL-Builders/recall-examples.git
cd mastra
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Run trading bot directly
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
pnpm start
```

```bash
# Run MCP server (for Claude Desktop integration)
pnpm mcp
```

## 🔧 Environment Variables

Create a `.env` file with:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
RECALL_API_KEY=rk-your-recall-api-key-here
RECALL_API_URL=https://sandbox-api-competitions.recall.network
TZ=UTC
```

## 📊 Configuration

Trading parameters in `src/constants.ts`:

- **Multi-Chain Token Addresses**: Complete mapping for all supported chains
- **Default Chain Preferences**: Optimized chain selection per token
- **Chain Type Mapping**: EVM vs SVM classification
- **Trading Intervals**: Configurable execution frequency

## 🏗️ Architecture

```
┌─────────────────┐    MCP Protocol    ┌──────────────────┐    HTTPS    ┌─────────────────┐
│ Claude Desktop  │ ◄─────────────────► │ Mastra MCP      │ ──────────► │ Recall Network  │
│ Integration     │                     │ Server          │             │ API             │
└─────────────────┘                     └──────────────────┘             └─────────────────┘
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           MODULAR TRADING SYSTEM                                        │
├─────────────────┬─────────────────┬─────────────────┬─────────────────────────────────┤
│    AGENT        │     TOOLS       │   WORKFLOWS     │           STEPS                 │
│                 │                 │                 │                                 │
│ • Smart Agent   │ • Price Tools   │ • Portfolio     │ • Fetch Prices                 │
│ • Risk Rules    │ • Portfolio     │   Rebalancing   │ • Analyze Distribution         │
│ • Strategy      │ • Trading       │ • Cross-Chain   │ • Execute Consolidation        │
│ • Instructions  │ • HTTP Client   │   Optimization  │ • Analyze Allocation           │
│                 │ • Utilities     │                 │ • Execute Rebalancing          │
│                 │                 │                 │ • Generate Reports             │
└─────────────────┴─────────────────┴─────────────────┴─────────────────────────────────┘
```

## 🧩 Modular Components

### 🤖 Agent (`src/mastra/agents/recall-trading-agent.ts`)

- Sophisticated cross-chain trading intelligence
- Advanced portfolio management strategies
- Comprehensive risk management rules
- Multi-token allocation optimization

### 🛠️ Tools (`src/mastra/tools/recall-trading/`)

**Modular Structure:**

- `price-tools.ts`: Real-time pricing and token discovery
- `portfolio-tools.ts`: Multi-chain portfolio management
- `trading-tools.ts`: Cross-chain trade execution
- `http-client.ts`: Reliable API communication
- `utils.ts`: Shared utility functions
- `types.ts`: TypeScript definitions and schemas

**Available Tools:**

- `getPrice`: Multi-chain price fetching with cross-chain support
- `getPortfolio`: Advanced portfolio analysis with filtering and grouping
- `executeTrade`: Symbol-based trading with validation
- `executeTradeByAddress`: Contract address-based trading
- `getTokenInfoByAddress`: Dynamic token discovery and pricing

### ⚡ Workflows (`src/mastra/workflows/recall-portfolio-rebalancing/`)

**Smart Portfolio Rebalancing Workflow:**

- **Modular Steps**: Each step is a separate, testable module
- **Price Fetching**: Real-time price data across all chains
- **Chain Analysis**: Distribution optimization and consolidation
- **Allocation Management**: Target vs actual allocation analysis
- **Iterative Rebalancing**: Continuous optimization until convergence
- **Comprehensive Reporting**: Detailed performance analytics

**Workflow Steps:**

1. `fetch-prices-step.ts`: Gather current market prices
2. `analyze-chain-distribution-step.ts`: Assess chain distribution efficiency
3. `execute-consolidation-step.ts`: Consolidate tokens for gas optimization
4. `analyze-allocation-step.ts`: Calculate target vs current allocation
5. `execute-rebalancing-step.ts`: Execute trades to reach target allocation
6. `generate-report-step.ts`: Comprehensive performance reporting

## 🎮 Usage Modes

### MCP Server Mode (Recommended)

```bash
# Start MCP server for Claude Desktop integration
pnpm mcp

# Configure in Claude Desktop settings:
# "Recall Trading Bot": {
#   "url": "http://localhost:4111/api/mcp/recallTradingServer/sse"
# }
```

### Direct Execution Mode

```bash
# Run trading bot with automatic workflow execution
pnpm dev
```

### Custom Workflow Execution

```javascript
import { mastra } from "./src/mastra/index.js";

// Execute portfolio rebalancing with custom parameters
const result = await mastra
  .getWorkflow("recallTradingWorkflow")
  .createRun()
  .start({
    usdcPercent: 40,
    wethPercent: 30,
    usdtPercent: 20,
    solPercent: 10,
    consolidateToChain: "svm",
    slippage: 1.0,
  });
```

## ✅ Competition Checklist

### Pre-Competition Setup

- [ ] Environment variables configured and tested
- [ ] Wallet address whitelisted in Recall Network
- [ ] MCP server tested with Claude Desktop integration
- [ ] Portfolio rebalancing strategy validated in sandbox
- [ ] Cross-chain trading functionality verified

### During Competition

- [ ] Real-time monitoring dashboard active
- [ ] Trade execution logs being captured
- [ ] Portfolio drift monitoring enabled
- [ ] Risk management rules enforced
- [ ] Performance metrics being tracked

### Post-Trade Verification

- [ ] All trades include detailed "reason" fields
- [ ] Cross-chain trades properly executed
- [ ] Portfolio allocation within target ranges
- [ ] Slippage tolerance respected
- [ ] Competition scoring metrics optimized

## 🛡️ Risk Management

### Portfolio Protection

- **Balance Validation**: Pre-trade balance checks across all chains
- **Slippage Controls**: Configurable tolerance (0.1% - 10%)
- **Allocation Limits**: Maximum deviation thresholds
- **Chain Distribution**: Risk diversification across blockchains

### Technical Safeguards

- **Retry Logic**: Exponential backoff for API failures
- **Error Handling**: Comprehensive error categorization
- **Circuit Breakers**: Automatic halt on consecutive failures
- **Monitoring**: Real-time alerting on anomalies

### Competition Compliance

- **Reason Logging**: All trades include strategic reasoning
- **Audit Trail**: Complete transaction history
- **Regulatory Compliance**: Meets competition requirements
- **Performance Tracking**: Detailed analytics and reporting

## 📈 Monitoring & Analytics

### Real-Time Metrics

- Portfolio value across all chains
- Allocation drift from targets
- Trading volume and frequency
- Cross-chain bridge status
- Gas cost optimization

### Performance Analytics

- Sharpe ratio and volatility metrics
- Rebalancing effectiveness
- Cross-chain arbitrage opportunities
- Competition scoring trends
- Risk-adjusted returns

### Alerting

- Large allocation drifts
- Failed trade executions
- Network connectivity issues
- Competition deadline approaches
- Performance threshold breaches

## 🔧 Development

### Project Structure

```
src/
├── mastra/
│   ├── agents/              # Trading intelligence
│   ├── tools/
│   │   └── recall-trading/  # Modular trading tools
│   └── workflows/
│       └── recall-portfolio-rebalancing/  # Smart rebalancing
├── constants.ts             # Configuration
├── mcp-server.ts           # MCP integration
└── runner.ts               # Direct execution
```

### Adding New Features

1. Create modular components in appropriate directories
2. Export through index files for clean imports
3. Add comprehensive TypeScript types
4. Include unit tests for all new functionality
5. Update agent instructions if tools change

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make modular, well-tested changes
4. Update documentation and types
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open Pull Request

## 📄 License

MIT License - See LICENSE file for details.

---

## 🎯 Key Features Summary

- **🌐 Multi-Chain**: Trade across 6 major blockchains
- **🏗️ Modular**: Clean, maintainable architecture
- **🤖 AI-Powered**: Intelligent trading decisions
- **⚡ Fast**: Optimized execution and gas efficiency
- **🛡️ Safe**: Comprehensive risk management
- **📊 Analytics**: Detailed performance tracking
- **🔌 Integrations**: Claude Desktop MCP support
- **🏆 Competition Ready**: Meets all requirements
