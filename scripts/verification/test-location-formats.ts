#!/usr/bin/env npx tsx
/**
 * Test different location formats returned by various LSP servers
 * This helps verify that our LocationLink support doesn't break existing servers
 */

import { spawn } from "child_process";

const testCases = [
  {
    name: "TypeScript (typescript-language-server)",
    command: ["npx", "typescript-language-server", "--stdio"],
    testFile: {
      uri: "file:///test/test.ts",
      content: `export function test() { return 42; }\nconst result = test();`,
      position: { line: 1, character: 15 }
    }
  },
  {
    name: "TypeScript (tsgo)",
    command: ["npx", "tsgo", "--lsp", "--stdio"],
    testFile: {
      uri: "file:///test/test.ts",
      content: `export function test() { return 42; }\nconst result = test();`,
      position: { line: 1, character: 15 }
    }
  }
];

async function testLSPServer(testCase: typeof testCases[0]) {
  console.log(`\n=== Testing ${testCase.name} ===`);
  
  return new Promise<void>((resolve) => {
    const lsp = spawn(testCase.command[0], testCase.command.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
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
      lsp.stdin.write(header + content);
    }

    let buffer = "";
    let initComplete = false;
    let definitionReceived = false;

    lsp.stdout.on("data", (data) => {
      buffer += data.toString();
      
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
          
          if (message.id === 1 && message.result) {
            // Initialize complete
            initComplete = true;
            sendNotification("initialized", {});
            
            // Open document
            sendNotification("textDocument/didOpen", {
              textDocument: {
                uri: testCase.testFile.uri,
                languageId: "typescript",
                version: 1,
                text: testCase.testFile.content
              }
            });
            
            // Send definition request
            setTimeout(() => {
              sendMessage("textDocument/definition", {
                textDocument: { uri: testCase.testFile.uri },
                position: testCase.testFile.position
              });
            }, 500);
          } else if (message.result && message.id > 1) {
            // Definition response
            console.log("Response received");
            
            // Check format
            if (Array.isArray(message.result) && message.result.length > 0) {
              const first = message.result[0];
              if (first && "targetUri" in first) {
                console.log("✅ Format: LocationLink[]");
                console.log("   Keys:", Object.keys(first).join(", "));
              } else if (first && "uri" in first) {
                console.log("✅ Format: Location[]");
                console.log("   Keys:", Object.keys(first).join(", "));
              }
            } else if (message.result && "uri" in message.result) {
              console.log("✅ Format: Location");
              console.log("   Keys:", Object.keys(message.result).join(", "));
            } else {
              console.log("❓ Unknown format");
              console.log("   Response:", JSON.stringify(message.result, null, 2));
            }
            
            definitionReceived = true;
            lsp.kill();
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    lsp.stderr.on("data", (data) => {
      // Suppress stderr output unless debugging
      if (process.env.DEBUG) {
        console.error("stderr:", data.toString());
      }
    });

    // Initialize
    sendMessage("initialize", {
      processId: process.pid,
      rootUri: "file:///test",
      capabilities: {
        textDocument: {
          definition: {
            linkSupport: true,
          },
        },
      },
    });

    // Timeout handler
    const timeout = setTimeout(() => {
      lsp.kill();
      if (!definitionReceived) {
        console.log("❌ Timeout - no response received");
      }
      resolve();
    }, 8000);

    lsp.on("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function main() {
  console.log("=== LSP Definition Response Format Test ===");
  console.log("This test verifies different response formats from LSP servers");
  console.log("Our implementation should handle both Location and LocationLink formats");
  
  for (const testCase of testCases) {
    await testLSPServer(testCase);
  }
  
  console.log("\n=== Summary ===");
  console.log("LocationLink format: Used by typescript-language-server, rust-analyzer");
  console.log("Location format: Used by tsgo, older LSP servers");
  console.log("Our implementation converts LocationLink to Location for compatibility");
}

main().catch(console.error);