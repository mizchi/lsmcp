# Python Project - Pyright Language Server Test

This directory contains a test Python project for the Pyright language server
integration.

## Files

- `main.py` - Main Python module with basic functionality
- `errors.py` - Python file with intentional errors for testing diagnostics
- `pyproject.toml` - Pyright configuration
- `.mcp.json` - MCP server configuration

## Testing

To test the Pyright integration:

1. Build the lsmcp project:
   ```bash
   cd ../..
   pnpm build
   ```

2. Test the server:
   ```bash
   node dist/lsmcp.js -p pyright
   ```

3. Test with MCP client (like Claude Desktop):
   - Add the `.mcp.json` configuration to your MCP client
   - Test various LSP operations on the Python files

## Expected Functionality

The pyright integration should support:

- **Hover information**: Type information and documentation
- **Diagnostics**: Type errors, undefined variables, import errors
- **Go to definition**: Navigate to function/class definitions
- **Find references**: Find all usages of symbols
- **Code completion**: Auto-complete suggestions
- **Document symbols**: List all symbols in a file
- **Formatting**: Code formatting (if configured)

## Example Errors

The `errors.py` file contains intentional errors that should be detected:

- Type annotation errors
- Undefined variables
- Import errors
- Attribute errors
- Missing return statements
