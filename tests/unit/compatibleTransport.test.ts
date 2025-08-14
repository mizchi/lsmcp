import { describe, it, expect } from "vitest";
import { createProtocolVersionTransform } from "../../src/utils/compatibleTransport.ts";

describe("compatibleTransport", () => {
  describe("createProtocolVersionTransform", () => {
    it("should convert numeric protocolVersion to string", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      // Send message with numeric protocolVersion
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: 1,
          capabilities: {},
          clientInfo: {
            name: "test",
            version: "1.0.0",
          },
        },
      });

      transform.write(Buffer.from(message + "\n"));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n").filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.method).toBe("initialize");
      expect(parsed.params.protocolVersion).toBe("2024-11-05");
      expect(typeof parsed.params.protocolVersion).toBe("string");
    });

    it("should preserve string protocolVersion", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      // Send message with string protocolVersion
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: {
            name: "test",
            version: "1.0.0",
          },
        },
      });

      transform.write(Buffer.from(message + "\n"));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n").filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.method).toBe("initialize");
      expect(parsed.params.protocolVersion).toBe("2024-11-05");
    });

    it("should not modify non-initialize messages", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      // Send non-initialize message
      const message = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          protocolVersion: 1, // This should not be converted
          toolName: "test",
        },
      });

      transform.write(Buffer.from(message + "\n"));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n").filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.method).toBe("tools/call");
      expect(parsed.params.protocolVersion).toBe(1); // Should remain numeric
    });

    it("should handle multiple messages", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      // Send multiple messages
      const messages = [
        JSON.stringify({
          method: "initialize",
          params: { protocolVersion: 123 },
        }),
        JSON.stringify({
          method: "test",
          params: { foo: "bar" },
        }),
        JSON.stringify({
          method: "initialize",
          params: { protocolVersion: "already-string" },
        }),
      ];

      transform.write(Buffer.from(messages.join("\n") + "\n"));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n").filter((l) => l.trim());

      expect(lines).toHaveLength(3);

      const msg1 = JSON.parse(lines[0]);
      expect(msg1.params.protocolVersion).toBe("2024-11-05");

      const msg2 = JSON.parse(lines[1]);
      expect(msg2.method).toBe("test");

      const msg3 = JSON.parse(lines[2]);
      expect(msg3.params.protocolVersion).toBe("already-string");
    });

    it("should handle invalid JSON gracefully", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      transform.write(Buffer.from("not valid json\n"));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n");

      // Invalid JSON should be passed through as-is
      expect(lines[0]).toBe("not valid json");
      expect(lines[1]).toBe("");
    });

    it("should handle partial messages correctly", async () => {
      const transform = createProtocolVersionTransform();
      const chunks: string[] = [];

      const promise = new Promise<void>((resolve) => {
        transform.on("data", (chunk) => {
          chunks.push(chunk.toString());
        });

        transform.on("end", () => {
          resolve();
        });
      });

      // Send message in parts
      const message = JSON.stringify({
        method: "initialize",
        params: { protocolVersion: 1 },
      });

      // Split message into two parts
      const part1 = message.substring(0, 20);
      const part2 = message.substring(20) + "\n";

      transform.write(Buffer.from(part1));
      transform.write(Buffer.from(part2));
      transform.end();

      await promise;

      const result = chunks.join("");
      const lines = result.split("\n").filter((l) => l.trim());

      expect(lines).toHaveLength(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.params.protocolVersion).toBe("2024-11-05");
    });
  });
});
