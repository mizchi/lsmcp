#\!/bin/bash
# Test search_for_pattern tool
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_for_pattern","arguments":{"substringPattern":"lsmcp-dev","relativePath":"."}}}'
  sleep 1
} | timeout 5 node --no-warnings dist/lsmcp.js -p typescript 2>/dev/null | grep '"id":2' | jq -r '.result.content[0].text' | head -10
