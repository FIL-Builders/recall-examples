#!/usr/bin/env node

import { mastra } from "./mastra/index.js";
import { INTERVAL_MIN } from "./constants.js";

async function runTradingBot() {
  console.log("🚀 Starting Recall Trading Bot...");
  console.log(
    `📊 Configuration: ${INTERVAL_MIN}min intervals, SMA window: 96 periods`
  );

  try {
    // Execute the trading workflow
    const result = await mastra
      .getWorkflow("recallTradingWorkflow")
      .createRun()
      .start({});

    console.log("📈 Workflow execution result:", result);

    // Schedule next execution
    setTimeout(
      () => {
        runTradingBot();
      },
      INTERVAL_MIN * 60 * 1000
    ); // Convert minutes to milliseconds
  } catch (error) {
    console.error("❌ Error running trading bot:", error);

    // Retry after 1 minute on error
    setTimeout(() => {
      runTradingBot();
    }, 60 * 1000);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down trading bot...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down trading bot...");
  process.exit(0);
});

// Start the bot
if (import.meta.url === `file://${process.argv[1]}`) {
  runTradingBot();
}
