import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { LibSQLStore } from "@mastra/libsql";
import { MCPServer } from "@mastra/mcp";

import { recallTradingWorkflow } from "./workflows";
import { recallTradingAgent } from "./agents/recall-trading-agent";
import { recallTradingTools } from "./tools";

// Create MCP Server to expose tools and agents
export const mcpServer = new MCPServer({
  name: "Recall Trading Bot",
  version: "1.0.0",
  description:
    "MCP server exposing Recall Network trading capabilities including momentum/mean-reversion strategies, portfolio management, and trade execution",
  tools: recallTradingTools,
  agents: {
    recallTradingAgent,
  },
  workflows: {
    recallTradingWorkflow,
  },
});

export const mastra = new Mastra({
  workflows: {
    recallTradingWorkflow,
  },
  agents: {
    recallTradingAgent,
  },
  mcpServers: {
    recallTradingServer: mcpServer,
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
