#!/usr/bin/env npx tsx
/**
 * Test typescript-language-server capabilities and LocationLink support
 */

import { spawn } from "child_process";

const lsp = spawn("npx", ["typescript-language-server", "--stdio"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    TSS_DEBUG: "true",
    TSS_LOG: "-level verbose"
  }
});

let messageId = 0;

function sendMessage(method: string, params: any) {
  const message = {
    jsonrpc: "2.0",
    id: ++messageId,
    method,
    params
  };
  const content = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
  console.log(`\nSending ${method}:`, JSON.stringify(params, null, 2));
  lsp.stdin.write(header + content);
}

function sendNotification(method: string, params: any) {
  const message = {
    jsonrpc: "2.0",
    method,
    params
  };
  const content = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n`;
  console.log(`\nSending notification ${method}`);
  lsp.stdin.write(header + content);
}

let buffer = "";
lsp.stdout.on("data", (data) => {
  buffer += data.toString();
  
  // Parse messages
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) break;
    
    const header = buffer.substring(0, headerEnd);
    const contentLengthMatch = header.match(/Content-Length: (\d+)/);
    if (!contentLengthMatch) break;
    
    const contentLength = parseInt(contentLengthMatch[1], 10);
    const messageStart = headerEnd + 4;
    
    if (buffer.length < messageStart + contentLength) break;
    
    const messageBody = buffer.substring(messageStart, messageStart + contentLength);
    buffer = buffer.substring(messageStart + contentLength);
    
    try {
      const message = JSON.parse(messageBody);
      console.log("\nReceived:", JSON.stringify(message, null, 2));
      
      if (message.id === 1 && message.result) {
        // Check capabilities
        const caps = message.result.capabilities;
        console.log("\n=== Server Capabilities ===");
        console.log("definitionProvider:", caps.definitionProvider);
        console.log("hoverProvider:", caps.hoverProvider);
        console.log("referencesProvider:", caps.referencesProvider);
        console.log("renameProvider:", caps.renameProvider);
        
        // Initialize complete, send initialized
        sendNotification("initialized", {});
        
        // Open document
        setTimeout(() => {
          const fileUri = `file://${process.cwd()}/test-definition.ts`;
          const fileContent = `// Test file for definition navigation

export function testFunction() {
  return "test";
}

export const testVariable = 42;

export class TestClass {
  method() {
    return "method";
  }
}

// Usage
const result = testFunction();
const value = testVariable;
const instance = new TestClass();
instance.method();`;
          
          sendNotification("textDocument/didOpen", {
            textDocument: {
              uri: fileUri,
              languageId: "typescript",
              version: 1,
              text: fileContent
            }
          });
          
          // Send definition request after a delay
          setTimeout(() => {
            sendMessage("textDocument/definition", {
              textDocument: { uri: fileUri },
              position: { line: 15, character: 15 } // testFunction() call
            });
          }, 1000);
        }, 500);
      } else if (message.id === 2 && message.result) {
        // Definition response
        console.log("\n=== Definition Response ===");
        console.log("Response format:");
        
        if (Array.isArray(message.result) && message.result.length > 0) {
          const first = message.result[0];
          if ("targetUri" in first) {
            console.log("✅ LocationLink format detected");
            console.log("Keys:", Object.keys(first));
          } else if ("uri" in first) {
            console.log("✅ Location format detected");
            console.log("Keys:", Object.keys(first));
          }
        }
        
        setTimeout(() => {
          lsp.kill();
          console.log("\n✅ Test completed");
        }, 500);
      }
    } catch (e) {
      console.error("Parse error:", e);
    }
  }
});

lsp.stderr.on("data", (data) => {
  console.error("stderr:", data.toString());
});

// Initialize
sendMessage("initialize", {
  processId: process.pid,
  rootUri: `file://${process.cwd()}`,
  capabilities: {
    textDocument: {
      definition: {
        linkSupport: true,
      },
    },
  },
});

// Kill after 10 seconds
setTimeout(() => {
  lsp.kill();
  console.log("\nProcess terminated");
}, 10000);