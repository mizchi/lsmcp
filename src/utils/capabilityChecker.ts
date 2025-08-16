/**
 * LSP capability checker utility
 */

import type { ServerCapabilities } from "vscode-languageserver-protocol";
import { spawn } from "child_process";
import { debugLogWithPrefix } from "./debugLog.ts";

/**
 * Get LSP capabilities for a given preset configuration
 */
export async function getCapabilitiesForPreset(
  config: any,
): Promise<ServerCapabilities | null> {
  if (!config.bin) {
    return null;
  }

  try {
    // Try to start the LSP server and get capabilities
    return await getCapabilitiesFromLSP(config.bin, config.args || []);
  } catch (error) {
    debugLogWithPrefix(
      "capabilityChecker",
      `Failed to get capabilities: ${error}`,
    );
    return null;
  }
}

/**
 * Start LSP server briefly to get its capabilities
 */
async function getCapabilitiesFromLSP(
  bin: string,
  args: string[],
): Promise<ServerCapabilities | null> {
  return new Promise((resolve) => {
    let capabilities: ServerCapabilities | null = null;
    let timeout: NodeJS.Timeout;

    try {
      const lsp = spawn(bin, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Set timeout
      timeout = setTimeout(() => {
        lsp.kill();
        resolve(null);
      }, 3000);

      let buffer = "";

      lsp.stdout.on("data", (data) => {
        buffer += data.toString();

        // Try to parse LSP messages
        const lines = buffer.split("\n");
        for (const line of lines) {
          if (line.includes("Content-Length:")) {
            // Parse LSP message
            const match = line.match(/Content-Length: (\d+)/);
            if (match) {
              const length = parseInt(match[1]);
              const messageStart = buffer.indexOf("\r\n\r\n");
              if (messageStart !== -1) {
                const message = buffer.substring(
                  messageStart + 4,
                  messageStart + 4 + length,
                );
                try {
                  const json = JSON.parse(message);
                  if (json.result?.capabilities) {
                    capabilities = json.result.capabilities;
                    clearTimeout(timeout);
                    lsp.kill();
                    resolve(capabilities);
                    return;
                  }
                } catch {
                  // Continue parsing
                }
              }
            }
          }
        }
      });

      // Send initialize request
      const initRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          processId: process.pid,
          rootPath: process.cwd(),
          rootUri: `file://${process.cwd()}`,
          capabilities: {},
          trace: "off",
        },
      };

      const message = JSON.stringify(initRequest);
      const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
      lsp.stdin.write(header + message);

      lsp.on("error", () => {
        clearTimeout(timeout);
        resolve(null);
      });

      lsp.on("exit", () => {
        clearTimeout(timeout);
        resolve(capabilities);
      });
    } catch (error) {
      debugLogWithPrefix("capabilityChecker", `Error: ${error}`);
      resolve(null);
    }
  });
}
