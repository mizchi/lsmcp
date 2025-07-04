import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { goplsAdapter } from "../../src/adapters/gopls.ts";
import { spawn } from "child_process";
import { createLSPClient } from "../../src/lsp/lspClient.ts";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("gopls adapter", () => {
  it("should have correct configuration", () => {
    expect(goplsAdapter.id).toBe("gopls");
    expect(goplsAdapter.name).toBe("gopls");
    expect(goplsAdapter.baseLanguage).toBe("go");
    expect(goplsAdapter.bin).toBe("gopls");
    expect(goplsAdapter.args).toEqual(["serve"]);
    expect(goplsAdapter.description).toBe("Official Go language server");
  });

  it("should have proper initialization options", () => {
    expect(goplsAdapter.initializationOptions).toBeDefined();
    const initOpts = goplsAdapter.initializationOptions as any;
    expect(initOpts.codelenses).toBeDefined();
    expect(initOpts.analyses).toBeDefined();
    expect(initOpts.staticcheck).toBe(true);
    expect(initOpts.gofumpt).toBe(true);
  });

  describe("doctor", () => {
    it("should check for gopls installation", async () => {
      if (!goplsAdapter.doctor) {
        throw new Error("Doctor function not defined");
      }

      const result = await goplsAdapter.doctor();

      // The result will depend on whether gopls is installed
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
      expect(typeof result.message).toBe("string");

      // If gopls is not installed, we should get appropriate error messages
      if (!result.ok) {
        expect(result.message).toMatch(
          /gopls is not installed|go install golang\.org\/x\/tools\/gopls@latest/,
        );
      } else {
        // If installed, we should see success messages
        expect(result.message).toContain("gopls is installed");
      }
    });
  });

  describe("LSP functionality (if gopls is installed)", () => {
    let tmpDir: string;
    let lspProcess: any;
    let client: any;

    beforeEach(async () => {
      // Create temporary directory for test files
      const hash = randomBytes(8).toString("hex");
      tmpDir = path.join(__dirname, `tmp-gopls-${hash}`);
      await fs.mkdir(tmpDir, { recursive: true });

      // Create go.mod file
      await fs.writeFile(
        path.join(tmpDir, "go.mod"),
        `module example.com/test

go 1.21
`,
      );
    });

    afterEach(async () => {
      try {
        if (client) {
          await client.stop();
        }
      } catch {
        // Ignore errors during cleanup
      }

      try {
        if (lspProcess && !lspProcess.killed) {
          lspProcess.kill();
        }
      } catch {
        // Ignore errors during cleanup
      }

      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Ignore errors during cleanup
      }
    });

    it("should start gopls server and handle basic Go file", async () => {
      // Skip test if gopls is not installed
      try {
        const { execSync } = await import("child_process");
        execSync("which gopls", { stdio: "ignore" });
      } catch {
        console.log("Skipping gopls test - gopls not installed");
        return;
      }

      // Create a simple Go file
      const goFile = path.join(tmpDir, "main.go");
      await fs.writeFile(
        goFile,
        `package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}

func add(a, b int) int {
    return a + b
}
`,
      );

      // Start gopls
      lspProcess = spawn(goplsAdapter.bin, goplsAdapter.args!, {
        cwd: tmpDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      client = createLSPClient({
        rootPath: tmpDir,
        process: lspProcess,
        languageId: "go",
        initializationOptions: goplsAdapter.initializationOptions,
      });

      await client.start();

      // Open the Go file
      const fileUri = `file://${goFile}`;
      client.openDocument(fileUri, await fs.readFile(goFile, "utf8"), "go");

      // Wait for LSP to process the document
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try to get hover information
      const hoverResponse = await client.sendRequest("textDocument/hover", {
        textDocument: { uri: fileUri },
        position: { line: 8, character: 5 }, // Position of 'add' function (0-indexed)
      });

      expect(hoverResponse).toBeDefined();
      if (hoverResponse?.contents) {
        const content =
          typeof hoverResponse.contents === "string"
            ? hoverResponse.contents
            : hoverResponse.contents.value;
        // gopls returns hover info that should contain function signature or type info
        expect(content).toBeDefined();
        expect(content.length).toBeGreaterThan(0);
        // The content format may vary, so just check it's not empty
        console.log("Hover response content:", content);
      }
    }, 10000);
  });
});
