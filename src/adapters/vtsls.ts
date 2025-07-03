import { execSync } from "node:child_process";
import type { LspAdapter } from "../types.ts";

/**
 * VTSLS adapter - VSCode-based TypeScript Language Server
 * VTSLS is an LSP wrapper for TypeScript language server based on VSCode's TypeScript extension
 */
export const vtslsAdapter: LspAdapter = {
  id: "vtsls",
  name: "VTSLS",
  baseLanguage: "typescript",
  description: "VSCode-based TypeScript Language Server with enhanced features",
  bin: "vtsls",
  args: ["--stdio"],
  initializationOptions: {
    // VTSLS specific configuration
    vtsls: {
      // Automatically use workspace TypeScript version if available
      autoUseWorkspaceTsdk: true,
      // Experimental features for better performance
      experimental: {
        completion: {
          // Limit completion entries for large projects
          entriesLimit: 10000,
          // Enable server-side fuzzy matching for better performance
          enableServerSideFuzzyMatch: true,
        },
      },
    },
    // TypeScript language server preferences
    typescript: {
      preferences: {
        includeCompletionsForModuleExports: true,
        includeCompletionsForImportStatements: true,
        includeCompletionsWithSnippetText: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsWithInsertText: true,
        allowIncompleteCompletions: true,
        generateReturnInDocTemplate: true,
        useLabelDetailsInCompletionEntries: true,
      },
      suggest: {
        autoImports: true,
        completeFunctionCalls: true,
        completeJSDocs: true,
        enabled: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsForImportStatements: true,
        includeCompletionsForModuleExports: true,
        includeCompletionsWithSnippetText: true,
        names: true,
        paths: true,
        classMemberSnippets: {
          enabled: true,
        },
        jsdoc: {
          generateReturns: true,
        },
        objectLiteralMethodSnippets: {
          enabled: true,
        },
      },
      inlayHints: {
        includeInlayEnumMemberValueHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
        includeInlayFunctionParameterTypeHints: true,
        includeInlayParameterNameHints: "all",
        includeInlayParameterNameHintsWhenArgumentMatchesName: true,
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayVariableTypeHints: true,
        includeInlayVariableTypeHintsWhenTypeMatchesName: true,
      },
      workspaceSymbols: {
        search: {
          mode: "auto",
        },
      },
    },
    // JavaScript language server preferences (similar to TypeScript)
    javascript: {
      preferences: {
        includeCompletionsForModuleExports: true,
        includeCompletionsForImportStatements: true,
        includeCompletionsWithSnippetText: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsWithInsertText: true,
        allowIncompleteCompletions: true,
        generateReturnInDocTemplate: true,
        useLabelDetailsInCompletionEntries: true,
      },
      suggest: {
        autoImports: true,
        completeFunctionCalls: true,
        completeJSDocs: true,
        enabled: true,
        includeAutomaticOptionalChainCompletions: true,
        includeCompletionsForImportStatements: true,
        includeCompletionsForModuleExports: true,
        includeCompletionsWithSnippetText: true,
        names: true,
        paths: true,
        classMemberSnippets: {
          enabled: true,
        },
        jsdoc: {
          generateReturns: true,
        },
        objectLiteralMethodSnippets: {
          enabled: true,
        },
      },
      inlayHints: {
        includeInlayEnumMemberValueHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
        includeInlayFunctionParameterTypeHints: true,
        includeInlayParameterNameHints: "all",
        includeInlayParameterNameHintsWhenArgumentMatchesName: true,
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayVariableTypeHints: true,
        includeInlayVariableTypeHintsWhenTypeMatchesName: true,
      },
    },
  },
  doctor: async () => {
    try {
      // Check if vtsls is available directly
      execSync("which vtsls", { stdio: "ignore" });
      return { ok: true };
    } catch {
      try {
        // Check if vtsls is available via npx
        execSync("npx vtsls --version", { stdio: "ignore" });
        return {
          ok: true,
          bin: "npx",
          args: ["vtsls", "--stdio"],
        };
      } catch {
        try {
          // Check if @vtsls/language-server is available
          execSync("npx @vtsls/language-server --version", { stdio: "ignore" });
          return {
            ok: true,
            bin: "npx",
            args: ["@vtsls/language-server", "--stdio"],
          };
        } catch {
          return {
            ok: false,
            message:
              "vtsls not found. Install with: npm install -g @vtsls/language-server",
          };
        }
      }
    }
  },
};