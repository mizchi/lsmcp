#!/usr/bin/env node

import { ReportManager } from "../src/memory/database/reportManager.ts";
import { resolve } from "path";

async function main() {
  const rootPath = resolve(process.cwd());
  console.log(`Generating report for: ${rootPath}`);
  
  const manager = new ReportManager(rootPath);
  
  try {
    const reportId = await manager.generateReport(
      "LSMCP Advanced Memory Feature Analysis",
      "Comprehensive analysis of the advanced memory report system implementation, including database architecture, API design, and integration patterns",
      true,
      `Analyze the advanced memory feature implementation focusing on:
1. Database architecture and SQLite integration
2. Report generation and management system
3. API design patterns and MCP tool integration
4. Configuration management with memoryAdvanced flag
5. Use cases and best practices
6. Code quality and maintainability
7. Potential improvements and future enhancements`
    );
    
    console.log(`Report generated successfully with ID: ${reportId}`);
    
    // Get and display the generated report
    const report = await manager.getLatestReport();
    
    if (report) {
      console.log("\n=== Report Summary ===");
      console.log(`Title: ${report.title}`);
      console.log(`Summary: ${report.summary}`);
      console.log(`Branch: ${report.branch}`);
      console.log(`Commit: ${report.commitHash}`);
      console.log(`Timestamp: ${new Date(report.timestamp).toISOString()}`);
      console.log(`\nOverview:`);
      console.log(`- Total Files: ${report.overview.totalFiles}`);
      console.log(`- Total Symbols: ${report.overview.totalSymbols}`);
      console.log(`- Languages: ${report.overview.languages?.slice(0, 5).map(l => l.language).join(", ")}`);
      
      if (report.aiAnalysis) {
        console.log(`\n=== AI Analysis ===`);
        console.log(`Architecture: ${report.aiAnalysis.architecture}`);
        console.log(`Code Quality Score: ${report.aiAnalysis.codeQuality?.maintainability}/100`);
        console.log(`\nKey Components:`);
        report.aiAnalysis.keyComponents?.forEach(comp => {
          console.log(`- ${comp.name}: ${comp.purpose} [complexity: ${comp.complexity}]`);
        });
        console.log(`\nImprovement Suggestions:`);
        report.aiAnalysis.suggestions?.forEach(sugg => {
          console.log(`- ${sugg}`);
        });
      }
    }
    
  } catch (error) {
    console.error("Error generating report:", error);
    process.exit(1);
  } finally {
    manager.close();
  }
}

main().catch(console.error);