/**
 * CapabilityChecker - Checks LSP server capabilities
 */

import type { ServerCapabilities } from "../protocol/types/index.ts";

export interface ToolCapabilityRequirement {
  toolName: string;
  requiredCapabilities: (keyof ServerCapabilities)[];
}

export class CapabilityChecker {
  private capabilities: ServerCapabilities | undefined;

  constructor(capabilities?: ServerCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Update the capabilities
   */
  setCapabilities(capabilities: ServerCapabilities | undefined): void {
    this.capabilities = capabilities;
  }

  /**
   * Check if server supports a specific capability
   */
  hasCapability(capability: keyof ServerCapabilities): boolean {
    if (!this.capabilities) {
      return false;
    }

    const value = this.capabilities[capability];
    
    // Handle boolean capabilities
    if (typeof value === "boolean") {
      return value;
    }
    
    // Handle object capabilities (non-null means supported)
    if (typeof value === "object" && value !== null) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if server supports multiple capabilities
   */
  hasCapabilities(capabilities: (keyof ServerCapabilities)[]): boolean {
    return capabilities.every(cap => this.hasCapability(cap));
  }

  /**
   * Check if a tool is supported based on its required capabilities
   */
  isToolSupported(requirement: ToolCapabilityRequirement): boolean {
    return this.hasCapabilities(requirement.requiredCapabilities);
  }

  /**
   * Filter tools based on server capabilities
   */
  filterTools<T extends { name: string }>(
    tools: T[],
    requirements: Map<string, (keyof ServerCapabilities)[]>
  ): T[] {
    if (!this.capabilities) {
      // If no capabilities, return all tools (optimistic)
      return tools;
    }

    return tools.filter(tool => {
      const required = requirements.get(tool.name);
      if (!required || required.length === 0) {
        // No requirements means always supported
        return true;
      }
      return this.hasCapabilities(required);
    });
  }

  /**
   * Get detailed capability support information
   */
  getCapabilitySupport(): Record<string, boolean> {
    const support: Record<string, boolean> = {};
    
    if (!this.capabilities) {
      return support;
    }

    // Check common capabilities
    const commonCapabilities: (keyof ServerCapabilities)[] = [
      "definitionProvider",
      "referencesProvider",
      "hoverProvider",
      "documentSymbolProvider",
      "workspaceSymbolProvider",
      "completionProvider",
      "signatureHelpProvider",
      "codeActionProvider",
      "codeLensProvider",
      "documentFormattingProvider",
      "documentRangeFormattingProvider",
      "documentOnTypeFormattingProvider",
      "renameProvider",
      "documentLinkProvider",
      "colorProvider",
      "foldingRangeProvider",
      "declarationProvider",
      "implementationProvider",
      "typeDefinitionProvider",
      "callHierarchyProvider",
      "semanticTokensProvider",
      "linkedEditingRangeProvider",
      "monikerProvider",
      "typeHierarchyProvider",
      "inlineValueProvider",
      "inlayHintProvider",
      "diagnosticProvider",
    ];

    for (const capability of commonCapabilities) {
      support[capability] = this.hasCapability(capability);
    }

    return support;
  }

  /**
   * Get human-readable capability names
   */
  static getCapabilityDisplayName(capability: keyof ServerCapabilities): string {
    const displayNames: Record<string, string> = {
      definitionProvider: "Go to Definition",
      referencesProvider: "Find References",
      hoverProvider: "Hover Information",
      documentSymbolProvider: "Document Symbols",
      workspaceSymbolProvider: "Workspace Symbols",
      completionProvider: "Code Completion",
      signatureHelpProvider: "Signature Help",
      codeActionProvider: "Code Actions",
      codeLensProvider: "Code Lens",
      documentFormattingProvider: "Format Document",
      documentRangeFormattingProvider: "Format Selection",
      documentOnTypeFormattingProvider: "Format on Type",
      renameProvider: "Rename Symbol",
      documentLinkProvider: "Document Links",
      colorProvider: "Color Information",
      foldingRangeProvider: "Code Folding",
      declarationProvider: "Go to Declaration",
      implementationProvider: "Go to Implementation",
      typeDefinitionProvider: "Go to Type Definition",
      callHierarchyProvider: "Call Hierarchy",
      semanticTokensProvider: "Semantic Tokens",
      linkedEditingRangeProvider: "Linked Editing",
      monikerProvider: "Monikers",
      typeHierarchyProvider: "Type Hierarchy",
      inlineValueProvider: "Inline Values",
      inlayHintProvider: "Inlay Hints",
      diagnosticProvider: "Pull Diagnostics",
    };

    return displayNames[capability as string] || String(capability);
  }
}

/**
 * Create a mapping of tool names to required capabilities
 */
export function createToolCapabilityMap(): Map<string, (keyof ServerCapabilities)[]> {
  const map = new Map<string, (keyof ServerCapabilities)[]>();

  // LSP tool requirements
  map.set("get_hover", ["hoverProvider"]);
  map.set("find_references", ["referencesProvider"]);
  map.set("get_definitions", ["definitionProvider"]);
  map.set("get_diagnostics", ["diagnosticProvider"]);
  map.set("get_all_diagnostics", ["diagnosticProvider"]);
  map.set("get_document_symbols", ["documentSymbolProvider"]);
  map.set("get_completion", ["completionProvider"]);
  map.set("get_signature_help", ["signatureHelpProvider"]);
  map.set("format_document", ["documentFormattingProvider"]);
  map.set("get_workspace_symbols", ["workspaceSymbolProvider"]);
  map.set("get_code_actions", ["codeActionProvider"]);
  map.set("rename_symbol", ["renameProvider"]);
  
  // Some tools might work with either of multiple capabilities
  // (These need special handling)
  
  return map;
}

/**
 * Export functions for checking specific capabilities
 */
export function supportsDefinition(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("definitionProvider");
}

export function supportsReferences(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("referencesProvider");
}

export function supportsHover(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("hoverProvider");
}

export function supportsCompletion(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("completionProvider");
}

export function supportsRename(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("renameProvider");
}

export function supportsFormatting(capabilities?: ServerCapabilities): boolean {
  return new CapabilityChecker(capabilities).hasCapability("documentFormattingProvider");
}

export function supportsDiagnostics(capabilities?: ServerCapabilities): boolean {
  const checker = new CapabilityChecker(capabilities);
  // Either push or pull diagnostics
  return checker.hasCapability("diagnosticProvider") || 
         checker.hasCapability("textDocumentSync");
}