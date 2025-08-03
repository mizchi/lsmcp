/**
 * Test script for onboarding tools
 */

import { execSync } from "child_process";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";

const testDir = "test-onboarding-project";

// Clean up and create test directory
rmSync(testDir, { recursive: true, force: true });
mkdirSync(testDir, { recursive: true });

// Create sample TypeScript files
writeFileSync(
  join(testDir, "index.ts"),
  `
export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  subtract(a: number, b: number): number {
    return a - b;
  }
}

export function calculate(op: string, a: number, b: number): number {
  const calc = new Calculator();
  switch (op) {
    case 'add': return calc.add(a, b);
    case 'subtract': return calc.subtract(a, b);
    default: throw new Error('Unknown operation');
  }
}
`,
);

writeFileSync(
  join(testDir, "utils.ts"),
  `
export interface Config {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export function log(level: LogLevel, message: string): void {
  console.log('[' + level + '] ' + message);
}
`,
);

console.log(`Created test project in ${testDir}/`);
console.log("\nTo test onboarding, use lsmcp with MCP client and run:");
console.log('1. check_index_onboarding { "root": "test-onboarding-project" }');
console.log('2. index_onboarding { "root": "test-onboarding-project" }');
console.log("3. Follow the instructions to index files");
console.log(
  '4. new_index_files { "pattern": "**/*.ts", "root": "test-onboarding-project" }',
);
console.log('5. new_search_symbol { "name": "Calculator" }');
