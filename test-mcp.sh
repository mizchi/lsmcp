#\!/bin/bash
# Test MCP protocol initialization
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{},"prompts":{}},"clientInfo":{"name":"test","version":"0.0.0"}}}' | pnpm lsmcp -p typescript 2>/dev/null | grep -A20 '"result"'
