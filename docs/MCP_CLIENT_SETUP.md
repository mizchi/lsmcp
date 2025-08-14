# MCP Client Setup Guide

## Important: Protocol Version Format

When configuring lsmcp as an MCP server, ensure that your MCP client sends the `protocolVersion` as a **string**, not a number.

### Correct Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",  // ✅ String format
    "capabilities": {},
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  }
}
```

### Incorrect Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": 1,  // ❌ Number format will be rejected
    "capabilities": {},
    "clientInfo": {
      "name": "your-client",
      "version": "1.0.0"
    }
  }
}
```

## Testing Your Setup

You can test if lsmcp is working correctly with this Node.js script:

```javascript
const { spawn } = require('child_process');
const path = require('path');

const proc = spawn('lsmcp', ['-p', 'typescript'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

const initRequest = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',  // Must be a string
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
}) + '\n';

proc.stdin.write(initRequest);

proc.stdout.on('data', (data) => {
  console.log('Response:', data.toString());
});
```

## Common Issues

### Error: "Expected string, received number"

This error occurs when the MCP client sends `protocolVersion` as a number instead of a string. Update your client configuration to send it as a string (e.g., `"2024-11-05"`).

### MCP Server Not Responding

1. Ensure lsmcp is installed correctly: `npm install -g @mizchi/lsmcp`
2. Test the binary directly: `lsmcp --help`
3. Check that the language server for your preset is installed
4. Enable debug mode: `MCP_DEBUG=1 LSP_DEBUG=1 lsmcp -p typescript`

## Supported Protocol Versions

lsmcp supports the MCP protocol version `2024-11-05` and later versions that are compatible with the `@modelcontextprotocol/sdk` v1.12.x.