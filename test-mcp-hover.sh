#\!/bin/bash
# Create a test TypeScript file
cat > /tmp/test.ts << 'TSEOF'
const message: string = "Hello World";
console.log(message);
TSEOF

# Test get_hover tool
{
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
  sleep 0.5
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_hover","arguments":{"root":"/tmp","filePath":"test.ts","line":1,"target":"message"}}}'
  sleep 1
} | timeout 5 node --no-warnings dist/lsmcp.js -p typescript 2>/dev/null | grep '"id":2' | jq -r '.result.content[0].text' | head -10
