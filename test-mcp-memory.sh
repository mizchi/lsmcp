#\!/bin/bash
# Test list_memories tool (doesn't need LSP)
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_memories","arguments":{"root":"/home/mizchi/mizchi/lsmcp"}}}'
  sleep 0.5
} | timeout 3 node --no-warnings dist/lsmcp.js -p typescript 2>/dev/null | grep '"id":2' | jq -r '.result.content[0].text'
