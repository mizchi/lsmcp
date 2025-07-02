import { z } from "zod";
import type { ToolDef } from "../utils/mcpHelpers.ts";

const schema = z.object({
  category: z
    .enum(["lsp", "typescript", "all"])
    .optional()
    .default("all")
    .describe("Filter tools by category"),
});

interface ToolInfo {
  name: string;
  description: string;
  category: "lsp" | "typescript";
}

export function createListToolsTool(
  lspTools: ToolDef<any>[],
  customTools: ToolDef<any>[] = [],
): ToolDef<typeof schema> {
  return {
    name: "list_tools",
    description: "List all available MCP tools",
    schema,
    execute: async ({ category }) => {
      const toolsInfo: ToolInfo[] = [];

      // Add LSP tools
      for (const tool of lspTools) {
        toolsInfo.push({
          name: tool.name,
          description: tool.description,
          category: "lsp",
        });
      }

      // Add custom tools (TypeScript-specific)
      for (const tool of customTools) {
        toolsInfo.push({
          name: tool.name,
          description: tool.description,
          category: "typescript",
        });
      }

      // Filter by category if specified
      let filteredTools = toolsInfo;
      if (category !== "all") {
        filteredTools = toolsInfo.filter((tool) => tool.category === category);
      }

      // Format the output
      let result = `# Available MCP Tools\n\n`;

      const lspToolsFiltered = filteredTools.filter(
        (t) => t.category === "lsp",
      );
      const tsToolsFiltered = filteredTools.filter(
        (t) => t.category === "typescript",
      );

      if (lspToolsFiltered.length > 0) {
        result += "## 🌐 LSP Tools (Language Server Protocol)\n";
        result +=
          "These tools work with any language that has an LSP server.\n";
        result +=
          "Make sure the appropriate LSP server is installed and running for your language.\n\n";

        for (const tool of lspToolsFiltered) {
          result += `### ${tool.name}\n`;
          result += `${tool.description}\n\n`;
        }
      }

      if (tsToolsFiltered.length > 0) {
        result += "## 📘 TypeScript Tools\n";
        result +=
          "These tools are specific to TypeScript and JavaScript development.\n\n";

        for (const tool of tsToolsFiltered) {
          result += `### ${tool.name}\n`;
          result += `${tool.description}\n\n`;
        }
      }

      result += "## 💡 Tips\n";
      if (category === "all" || category === "lsp") {
        result +=
          "- LSP tools work with any programming language that has LSP support\n";
      }
      if (category === "all" || category === "typescript") {
        result +=
          "- TypeScript tools provide specialized functionality for TS/JS development\n";
      }
      result +=
        "- Get help for any tool: use the tool with no parameters to see its schema\n";

      return result;
    },
  };
}
