/**
 * Enhanced error class for MCP tools with helpful suggestions
 */
export class MCPToolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly suggestions: string[] = [],
    public readonly relatedTools: string[] = [],
  ) {
    super(message);
    this.name = "MCPToolError";
  }

  /**
   * Format the error with suggestions and related tools
   */
  format(): string {
    let result = `❌ Error: ${this.message}`;
    result += `\n   Code: ${this.code}`;

    if (this.suggestions.length > 0) {
      result += "\n\n💡 Suggestions:";
      this.suggestions.forEach((suggestion) => {
        result += `\n   • ${suggestion}`;
      });
    }

    if (this.relatedTools.length > 0) {
      result += "\n\n🔧 Alternative tools you can try:";
      this.relatedTools.forEach((tool) => {
        result += `\n   • ${tool}`;
      });
    }

    return result;
  }
}

// CommonErrors was removed as it was not used anywhere in the codebase
// These error factories can be recreated if needed in the future
