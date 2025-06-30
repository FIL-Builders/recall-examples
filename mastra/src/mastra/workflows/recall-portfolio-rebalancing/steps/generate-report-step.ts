import { createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { TradeExecutionSchema, AllocationAnalysisSchema } from "../types";

/**
 * Step 6: Generate comprehensive report
 */
export const generateReportStep = createStep({
  id: "generate-report",
  description: "Generate final execution report",
  inputSchema: z.object({
    rebalancingResults: z.array(TradeExecutionSchema),
    totalRebalancingTrades: z.number(),
    totalRebalancingVolumeUSD: z.number(),
    analysis: AllocationAnalysisSchema,
    consolidationResults: z.array(TradeExecutionSchema),
    finalAllocation: z.record(z.string(), z.number()),
    iterationsCompleted: z.number(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    summary: z.object({
      timestamp: z.string(),
      portfolioValueUSD: z.number(),
      consolidationExecuted: z.boolean(),
      consolidationTrades: z.number(),
      rebalancingRequired: z.boolean(),
      rebalancingTrades: z.number(),
      totalVolumeUSD: z.number(),
      allocationBefore: z.record(z.string(), z.number()),
      allocationTarget: z.record(z.string(), z.number()),
      allocationFinal: z.record(z.string(), z.number()),
      maxDriftBefore: z.number(),
      maxDriftAfter: z.number(),
      iterationsCompleted: z.number(),
      recommendations: z.array(z.string()),
    }),
    details: z.any(),
  }),
  execute: async ({ inputData }) => {
    const {
      analysis,
      rebalancingResults,
      consolidationResults,
      finalAllocation,
      iterationsCompleted,
    } = inputData;

    console.log("📊 Generating execution report...");

    const totalConsolidationTrades = consolidationResults.filter(
      (r) => r.success
    ).length;
    const totalRebalancingTrades = rebalancingResults.filter(
      (r) => r.success
    ).length;
    const totalVolumeUSD = inputData.totalRebalancingVolumeUSD;

    const maxDriftBefore = Math.max(
      ...Object.values(analysis.allocationDrift as Record<string, number>)
    );

    // Calculate final drift
    const finalDrift: Record<string, number> = {};
    let maxDriftAfter = 0;

    for (const [symbol, targetPercent] of Object.entries(
      analysis.targetAllocation as Record<string, number>
    )) {
      const finalPercent = finalAllocation[symbol] || 0;
      const drift = Math.abs(finalPercent - targetPercent);
      finalDrift[symbol] = drift;
      maxDriftAfter = Math.max(maxDriftAfter, drift);
    }

    const recommendations: string[] = [];

    if (totalConsolidationTrades > 0) {
      recommendations.push(
        `Successfully consolidated tokens across ${totalConsolidationTrades} chain moves.`
      );
    }

    if (analysis.needsRebalancing && totalRebalancingTrades === 0) {
      recommendations.push(
        "Portfolio needed rebalancing but no trades executed. Check balances and market conditions."
      );
    }

    if (totalRebalancingTrades > 0) {
      const driftImprovement =
        ((maxDriftBefore - maxDriftAfter) / maxDriftBefore) * 100;
      recommendations.push(
        `Rebalancing improved allocation drift by ${driftImprovement.toFixed(1)}% over ${iterationsCompleted} iterations.`
      );
    }

    if (maxDriftAfter > 0.01) {
      recommendations.push(
        `Portfolio still has ${(maxDriftAfter * 100).toFixed(2)}% drift from target. Consider running again if needed.`
      );
    } else {
      recommendations.push("Portfolio is now very close to target allocation!");
    }

    const summary = {
      timestamp: new Date().toISOString(),
      portfolioValueUSD: analysis.totalValueUSD,
      consolidationExecuted: totalConsolidationTrades > 0,
      consolidationTrades: totalConsolidationTrades,
      rebalancingRequired: analysis.needsRebalancing,
      rebalancingTrades: totalRebalancingTrades,
      totalVolumeUSD,
      allocationBefore: analysis.currentAllocation,
      allocationTarget: analysis.targetAllocation,
      allocationFinal: finalAllocation,
      maxDriftBefore,
      maxDriftAfter,
      iterationsCompleted,
      recommendations,
    };

    console.log("📋 Smart Rebalancing Summary:");
    console.log(`  Portfolio Value: $${summary.portfolioValueUSD.toFixed(2)}`);
    console.log(
      `  Consolidation: ${summary.consolidationExecuted ? summary.consolidationTrades + " trades" : "Skipped"}`
    );
    console.log(
      `  Rebalancing: ${summary.rebalancingTrades} trades over ${iterationsCompleted} iterations`
    );
    console.log(`  Total Volume: $${summary.totalVolumeUSD.toFixed(2)}`);
    console.log(
      `  Drift Improvement: ${(maxDriftBefore * 100).toFixed(2)}% → ${(maxDriftAfter * 100).toFixed(2)}%`
    );

    return {
      success: true,
      summary,
      details: {
        analysis,
        consolidationResults,
        rebalancingResults,
        finalAllocation,
        finalDrift,
      },
    };
  },
});
