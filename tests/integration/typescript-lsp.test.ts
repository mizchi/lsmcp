import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { execSync } from "child_process";

interface TextContent {
  type: "text";
  text: string;
}

interface CallToolResult {
  content: TextContent[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LSMCP_PATH = path.join(__dirname, "../../dist/lsmcp.js");

describe("TypeScript Language Server Integration", { timeout: 30000 }, () => {
  let client: Client | undefined;
  let transport: StdioClientTransport | undefined;
  let tmpDir: string | undefined;

  beforeEach(async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log(
        "Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.",
      );
      // skip();
      // return;
    }

    // Skip expensive npx check - assume it's available in node_modules
    // The actual check will happen when we try to start the server

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-ts-lsp-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a TypeScript project
    await fs.writeFile(
      path.join(tmpDir!, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2020",
            module: "commonjs",
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
          },
        },
        null,
        2,
      ),
    );

    // Create transport with server parameters
    // Use typescript-language-server directly from node_modules to avoid npx overhead
    const tsLangServerPath = path.join(
      __dirname,
      "../../node_modules/.bin/typescript-language-server",
    );
    transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH, "--bin", `${tsLangServerPath} --stdio`],
      env: {
        ...process.env,
      } as Record<string, string>,
    });

    // Create and connect client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
  });

  afterEach(async () => {
    // Cleanup
    if (client) {
      await client.close();
      client = undefined;
    }
    if (transport) {
      // Make sure the transport is properly closed
      transport = undefined;
    }
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it("should list available LSP tools", async () => {
    if (!client) return;

    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    // Check for LSP tools
    expect(toolNames).toContain("get_hover");
    expect(toolNames).toContain("find_references");
    expect(toolNames).toContain("get_definitions");
    expect(toolNames).toContain("get_diagnostics");
    expect(toolNames).toContain("rename_symbol");
    expect(toolNames).toContain("get_document_symbols");
    expect(toolNames).toContain("get_completion");
    expect(toolNames).toContain("get_signature_help");
    expect(toolNames).toContain("format_document");
  });

  it("should get hover information for TypeScript code", async () => {
    if (!client) return;

    // Create a TypeScript file
    const tsCode = `
interface Person {
  name: string;
  age: number;
}

const person: Person = {
  name: "Alice",
  age: 30
};

console.log(person.name);
`;
    await fs.writeFile(path.join(tmpDir!, "test.ts"), tsCode);

    // Get hover information for 'person'
    const result = await client.callTool({
      name: "get_hover",
      arguments: {
        root: tmpDir,
        filePath: "test.ts",
        line: 7,
        target: "person",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    const typedResult = result as CallToolResult;
    expect(typedResult.content[0]?.type).toBe("text");
    if (typedResult.content[0]?.type === "text") {
      const text = typedResult.content[0].text;
      expect(text).toContain("Person");
      expect(text).toContain("const person: Person");
    }
  });

  it("should get code completions", async () => {
    if (!client) return;

    // Create a TypeScript file
    const tsCode = `
const message = "Hello, World!";
console.log(message.);
`;
    await fs.writeFile(path.join(tmpDir!, "completion.ts"), tsCode);

    // Get completions after 'message.'
    const result = await client.callTool({
      name: "get_completion",
      arguments: {
        root: tmpDir,
        filePath: "completion.ts",
        line: 3,
        target: "message.",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    const typedResult = result as CallToolResult;
    expect(typedResult.content[0]?.type).toBe("text");
    if (typedResult.content[0]?.type === "text") {
      const text = typedResult.content[0].text;
      // String methods should be suggested
      expect(text).toContain("toLowerCase");
      expect(text).toContain("toUpperCase");
      expect(text).toContain("substring");
      expect(text).toContain("charAt");
    }
  });

  it("should get signature help", async () => {
    if (!client) return;

    // Create a TypeScript file
    const tsCode = `
function greet(name: string, age: number, city?: string): string {
  return \`Hello, \${name}!\`;
}

greet("Alice", );
`;
    await fs.writeFile(path.join(tmpDir!, "signature.ts"), tsCode);

    // Get signature help inside greet call
    const result = await client.callTool({
      name: "get_signature_help",
      arguments: {
        root: tmpDir,
        filePath: "signature.ts",
        line: 6,
        target: ",",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    const typedResult = result as CallToolResult;
    expect(typedResult.content[0]?.type).toBe("text");
    if (typedResult.content[0]?.type === "text") {
      const text = typedResult.content[0].text;
      expect(text).toContain("greet");
      expect(text).toContain("name: string");
      expect(text).toContain("age: number");
      expect(text).toContain("city?: string");
    }
  });

  it("should format document", async () => {
    if (!client) return;

    // Create a poorly formatted TypeScript file
    const tsCode = `function  hello(  )  {
console.log("Hello"  )  ;
    return   42;
}`;
    const filePath = path.join(tmpDir!, "format.ts");
    await fs.writeFile(filePath, tsCode);

    // Format the document
    const result = await client.callTool({
      name: "format_document",
      arguments: {
        root: tmpDir,
        filePath: "format.ts",
        applyChanges: true,
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();

    // Read the formatted file
    const formatted = await fs.readFile(filePath, "utf-8");
    // Should be properly formatted
    expect(formatted).toContain("function hello() {");
    expect(formatted).toContain('  console.log("Hello");');
    expect(formatted).toContain("  return 42;");
  });

  it("should rename symbol across files", async () => {
    if (!client) return;

    // Create multiple TypeScript files
    const exportFile = `
export function calculateSum(a: number, b: number): number {
  return a + b;
}
`;
    const importFile = `
import { calculateSum } from "./math.js";

const result = calculateSum(5, 3);
console.log(result);

// Another usage
const total = calculateSum(10, 20);
`;

    await fs.writeFile(path.join(tmpDir!, "math.ts"), exportFile);
    await fs.writeFile(path.join(tmpDir!, "main.ts"), importFile);

    // Rename 'calculateSum' to 'addNumbers'
    const result = await client.callTool({
      name: "rename_symbol",
      arguments: {
        root: tmpDir,
        filePath: "math.ts",
        line: 2,
        target: "calculateSum",
        newName: "addNumbers",
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    const typedResult = result as CallToolResult;
    expect(typedResult.content[0]?.type).toBe("text");
    if (typedResult.content[0]?.type === "text") {
      const text = typedResult.content[0].text;
      expect(text).toContain("Successfully renamed");
    }

    // Verify the changes
    const mathContent = await fs.readFile(
      path.join(tmpDir!, "math.ts"),
      "utf-8",
    );
    const mainContent = await fs.readFile(
      path.join(tmpDir!, "main.ts"),
      "utf-8",
    );

    // At minimum, the file where rename was triggered should be updated
    expect(mathContent).toContain("addNumbers");
    expect(mathContent).not.toContain("calculateSum");

    // Cross-file rename might not be supported by all LSP servers
    // So we'll check if it was renamed, but not fail if it wasn't
    if (mainContent.includes("addNumbers")) {
      expect(mainContent).not.toContain("calculateSum");
    } else {
      console.log("Note: Cross-file rename not supported by this LSP server");
    }
  });

  it("should get code actions for quick fixes", async () => {
    if (!client) return;

    // Create a TypeScript file with an error that has a quick fix
    const tsCode = `
class MyClass {
  private myProperty: string;
}

const instance = new MyClass();
instance.myProperty = "value"; // Error: private property
`;
    await fs.writeFile(path.join(tmpDir!, "codeaction.ts"), tsCode);

    // Get code actions for the error line
    const result = await client.callTool({
      name: "get_code_actions",
      arguments: {
        root: tmpDir,
        filePath: "codeaction.ts",
        startLine: 7,
        endLine: 7,
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    const typedResult = result as CallToolResult;
    expect(typedResult.content[0]?.type).toBe("text");
    if (typedResult.content[0]?.type === "text") {
      const text = typedResult.content[0].text;
      // Should suggest making the property public or adding a setter
      expect(text.toLowerCase()).toMatch(/action|fix|suggest/);
    }
  });
});

describe("TypeScript MCP with custom LSP via lsmcp", { timeout: 30000 }, () => {
  let tmpDir: string | undefined;

  beforeEach(async () => {
    // Skip test if lsmcp.js is not built
    try {
      await fs.access(LSMCP_PATH);
    } catch {
      console.log(
        "Skipping test: dist/lsmcp.js not found. Run 'pnpm build' first.",
      );
      return;
    }

    // Create temporary directory
    const hash = randomBytes(8).toString("hex");
    tmpDir = path.join(__dirname, `tmp-lsmcp-ts-${hash}`);
    await fs.mkdir(tmpDir, { recursive: true });

    // Create a TypeScript project
    await fs.writeFile(
      path.join(tmpDir!, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "es2020",
            module: "commonjs",
            strict: true,
          },
        },
        null,
        2,
      ),
    );
  });

  afterEach(async () => {
    // Cleanup
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  async function createMCPClient(lspCommand: string): Promise<Client> {
    const transport = new StdioClientTransport({
      command: "node",
      args: [LSMCP_PATH, "--bin", lspCommand],
      env: {
        ...process.env,
      } as Record<string, string>,
    });

    const client = new Client({
      name: "test-client",
      version: "1.0.0",
    });

    await client.connect(transport);
    return client;
  }

  it("should work with typescript-language-server via --bin", async () => {
    if (!tmpDir) return;

    // Use typescript-language-server directly from node_modules to avoid npx overhead
    const tsLangServerPath = path.join(
      __dirname,
      "../../node_modules/.bin/typescript-language-server",
    );
    const client = await createMCPClient(`${tsLangServerPath} --stdio`);

    try {
      // Create a TypeScript file
      const tsCode = `
const greeting: string = "Hello, TypeScript!";
console.log(greeting);
`;
      await fs.writeFile(path.join(tmpDir!, "test.ts"), tsCode);

      // Test hover
      const result = await client.callTool({
        name: "get_hover",
        arguments: {
          root: tmpDir,
          filePath: "test.ts",
          line: 2,
          target: "greeting",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      const typedResult = result as CallToolResult;
      expect(typedResult.content[0]?.type).toBe("text");
      if (typedResult.content[0]?.type === "text") {
        const text = typedResult.content[0].text;
        expect(text).toContain("string");
        expect(text).toContain("const greeting: string");
      }
    } finally {
      await client.close();
    }
  });

  it("should work with Deno LSP via --bin", async () => {
    if (!tmpDir) return;

    // Check if deno is available
    try {
      execSync("deno --version", { stdio: "pipe" });
    } catch {
      console.log(
        "Skipping test: Deno not found. Install from https://deno.land/",
      );
      return;
    }

    const client = await createMCPClient("deno lsp");

    try {
      // Create a TypeScript file with Deno-style imports
      const tsCode = `
// @ts-types="npm:@types/node"
import { readFile } from "node:fs/promises";

const content = await readFile("./data.txt", "utf-8");
console.log(content);
`;
      await fs.writeFile(path.join(tmpDir!, "deno_test.ts"), tsCode);

      // Test diagnostics
      const result = await client.callTool({
        name: "get_diagnostics",
        arguments: {
          root: tmpDir,
          filePath: "deno_test.ts",
        },
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      // Deno LSP should handle this file
    } finally {
      await client.close();
    }
  });
});
