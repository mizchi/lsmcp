/**
 * Compatible transport for handling protocol version compatibility
 */

import { Transform } from "stream";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { debugLogWithPrefix } from "./debugLog.ts";

/**
 * Creates a transform stream that converts numeric protocolVersion to string
 */
export function createProtocolVersionTransform(): Transform {
  let buffer = "";

  return new Transform({
    transform(chunk: Buffer, _encoding: string, callback) {
      buffer += chunk.toString();

      // Process complete lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);

            // Fix protocolVersion format if needed
            if (
              message.method === "initialize" &&
              message.params &&
              typeof message.params.protocolVersion === "number"
            ) {
              debugLogWithPrefix(
                "MCP",
                `Converting numeric protocolVersion ${message.params.protocolVersion} to string "2024-11-05"`,
              );

              // Convert number to MCP protocol version string
              message.params.protocolVersion = "2024-11-05";

              // Push the modified message
              this.push(JSON.stringify(message) + "\n");
            } else {
              // Push the original line
              this.push(line + "\n");
            }
          } catch (error) {
            // If not valid JSON, forward as-is
            this.push(line + "\n");
          }
        } else {
          // Empty line
          this.push("\n");
        }
      }

      callback();
    },

    flush(callback) {
      // Process any remaining buffer
      if (buffer.trim()) {
        this.push(buffer);
      }
      callback();
    },
  });
}

/**
 * Create a compatible StdioServerTransport with protocol version handling
 */
export function createCompatibleTransport(): StdioServerTransport {
  const transform = createProtocolVersionTransform();

  // Pipe stdin through transform
  const transformedStdin = process.stdin.pipe(transform);

  // Create transport with transformed stdin
  return new StdioServerTransport(transformedStdin as any, process.stdout);
}
