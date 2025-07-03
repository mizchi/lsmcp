import { execSync } from "node:child_process";
import { BaseLspAdapter } from "../lsp/baseLspAdapter.ts";
import type { LspAdapter } from "../types.ts";

/**
 * Enhanced Pyright adapter with validation and health monitoring
 */
export class PyrightAdapter extends BaseLspAdapter {
  constructor() {
    const config: LspAdapter = {
      id: "pyright",
      name: "Pyright",
      baseLanguage: "python",
      description: "Microsoft's Pyright Python language server with enhanced validation",
      bin: "pyright-langserver",
      args: ["--stdio"],
      initializationOptions: {
        python: {
          analysis: {
            autoSearchPaths: true,
            useLibraryCodeForTypes: true,
            diagnosticMode: "workspace",
          },
        },
      },
      doctor: async () => {
        return this.performDoctorCheck();
      },
    };

    super(config);
  }

  /**
   * Comprehensive doctor check for Pyright availability - prioritizing uv
   */
  private async performDoctorCheck(): Promise<{ ok: boolean; message?: string }> {
    // Priority 1: Check via uv (preferred for Python projects)
    try {
      execSync("uv run pyright-langserver --version", { stdio: "ignore", timeout: 5000 });
      // Update config to use uv
      this.config.bin = "uv";
      this.config.args = ["run", "pyright-langserver", "--stdio"];
      return { ok: true, message: "pyright-langserver available via uv (recommended)" };
    } catch {
      // Continue to next check
    }

    // Priority 2: Check if uv can install pyright
    try {
      execSync("which uv", { stdio: "ignore" });
      // uv is available, suggest installation
      return { 
        ok: false, 
        message: "uv found but pyright not installed. Install with: uv add pyright" 
      };
    } catch {
      // uv not available, continue to other methods
    }

    // Priority 3: Check direct installation
    try {
      execSync("which pyright-langserver", { stdio: "ignore" });
      return { ok: true, message: "pyright-langserver found in PATH" };
    } catch {
      // Continue to next check
    }

    // Priority 4: Check via npx (fallback)
    try {
      execSync("npx pyright-langserver --version", { stdio: "ignore", timeout: 5000 });
      // Update config to use npx
      this.config.bin = "npx";
      this.config.args = ["pyright-langserver", "--stdio"];
      return { ok: true, message: "pyright-langserver available via npx" };
    } catch {
      // Continue to next check
    }

    // Check if pyright (not pyright-langserver) is available
    try {
      execSync("which pyright", { stdio: "ignore" });
      return { 
        ok: false, 
        message: "pyright CLI found but pyright-langserver not available. Install with: uv add pyright (recommended) or npm install -g pyright" 
      };
    } catch {
      // Final fallback
    }

    return {
      ok: false,
      message: "pyright-langserver not found. Install with: uv add pyright (recommended), npm install -g pyright, or pip install pyright",
    };
  }

  /**
   * Get Python-specific environment variables
   */
  protected getEnvironmentVariables(): Record<string, string> {
    return {
      ...process.env,
      // Ensure Python can find modules
      PYTHONPATH: process.env.PYTHONPATH || "",
      // Disable Python buffering for better LSP communication
      PYTHONUNBUFFERED: "1",
    };
  }

  /**
   * Get Python-specific test content
   */
  protected getDefaultTestContent(): string {
    return `"""
Example Python module for testing pyright language server integration.
"""

from typing import List, Optional, Dict, Any
import json
import os


class Calculator:
    """A simple calculator class for testing."""
    
    def __init__(self) -> None:
        self.history: List[str] = []
    
    def add(self, a: int, b: int) -> int:
        """Add two numbers."""
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def subtract(self, a: int, b: int) -> int:
        """Subtract two numbers."""
        result = a - b
        self.history.append(f"{a} - {b} = {result}")
        return result


def process_data(data: Dict[str, Any]) -> Optional[str]:
    """Process data and return result."""
    if not isinstance(data, dict):
        return None
    
    name = data.get("name")
    if not name:
        return None
    
    return f"Hello, {name}!"


def main() -> None:
    """Main function for testing."""
    calc = Calculator()
    
    # Normal operations
    result1 = calc.add(5, 3)
    result2 = calc.subtract(10, 4)
    
    # Test data processing
    test_data = {"name": "World", "age": 30}
    message = process_data(test_data)
    
    print(f"Results: {result1}, {result2}")
    print(f"Message: {message}")
    print(f"History: {calc.history}")


if __name__ == "__main__":
    main()
`;
  }

  /**
   * Get Python-specific test file name
   */
  protected getDefaultTestFileName(): string {
    return "test_validation.py";
  }

  /**
   * Get Pyright-specific supported features
   */
  getSupportedFeatures(): string[] {
    return [
      'textDocument/hover',
      'textDocument/completion',
      'textDocument/definition',
      'textDocument/references',
      'textDocument/documentSymbol',
      'textDocument/rename',
      'textDocument/codeAction',
      'textDocument/signatureHelp',
      'textDocument/diagnostic'
    ];
  }

  /**
   * Get Pyright-specific unsupported features
   */
  getUnsupportedFeatures(): string[] {
    return [
      'textDocument/formatting', // Pyright doesn't do formatting
    ];
  }
}

// Create and export the adapter instance
export const pyrightAdapterV2 = new PyrightAdapter();

// Export the legacy format for backward compatibility
export const pyrightAdapter: LspAdapter = pyrightAdapterV2.getConfig();