#!/usr/bin/env node

import { mcpServer } from "./mastra/index.js";

async function startMCPServer() {
  try {
    console.log("🚀 Starting Recall Trading MCP Server...");
    console.log("📊 Exposing tools: getPrice, getPortfolio, executeTrade");
    console.log("🤖 Exposing agent: ask_recallTradingAgent");
    console.log("⚡ Exposing workflow: run_recallTradingWorkflow");

    // Start in stdio mode for command-line usage
    await mcpServer.startStdio();
  } catch (error) {
    console.error("❌ Error starting MCP server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await mcpServer.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down MCP server...");
  await mcpServer.close();
  process.exit(0);
});

startMCPServer();
