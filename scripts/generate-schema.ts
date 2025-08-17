#!/usr/bin/env tsx
/**
 * Generate JSON Schema from Zod schema
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { zodToJsonSchema } from "zod-to-json-schema";
import { configSchema } from "../src/config/schema.ts";

// Generate JSON Schema
const jsonSchema = zodToJsonSchema(configSchema, {
  name: "LSMCPConfig",
  $refStrategy: "none",
  errorMessages: true,
  markdownDescription: true,
});

// Add additional metadata
const schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "https://github.com/mizchi/lsmcp/lsmcp.schema.json",
  title: "LSMCP Configuration",
  description: "Configuration schema for Language Service MCP",
  ...(jsonSchema as any),
};

// Add examples
schema.examples = [
  {
    preset: "tsgo",
  },
  {
    preset: "pyright",
    files: ["**/*.py", "**/*.pyi"],
  },
  {
    lsp: {
      bin: "deno",
      args: ["lsp"],
    },
    files: ["**/*.ts", "**/*.tsx"],
  },
  {
    preset: "tsgo",
    settings: {
      autoIndex: true,
      indexConcurrency: 10,
    },
    symbolFilter: {
      excludeKinds: ["Variable", "Constant"],
      includeOnlyTopLevel: true,
    },
  },
];

// Write to file
const outputPath = join(process.cwd(), "lsmcp.schema.json");
writeFileSync(outputPath, JSON.stringify(schema, null, 2) + "\n");

console.log(`✅ Schema generated at: ${outputPath}`);
console.log("\nTo use this schema in your config file, add:");
console.log(`  "$schema": "../lsmcp.schema.json"`);
