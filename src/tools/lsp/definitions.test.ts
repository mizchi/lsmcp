import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { lspGetDefinitionsTool } from "./definitions.ts";
import { setupLSPForTest, teardownLSPForTest } from "@internal/lsp-client";
import path from "path";

describe.skip("lspGetDefinitionsTool with include_body", () => {
  const root = path.resolve(import.meta.dirname, "../../../..");

  beforeAll(async () => {
    await setupLSPForTest(root);
  });

  afterAll(async () => {
    await teardownLSPForTest();
  });

  describe("include_body option", () => {
    it("should get full body of a class", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "UserService",
        symbolName: "UserService",
        include_body: true,
      });

      // Check that we get the full class body
      expect(result).toContain("class UserService");
      expect(result).toContain("private users: Map<UserId, User>");
      expect(result).toContain("constructor()");
      expect(result).toContain("getUser(id: UserId)");
      expect(result).toContain("createUser(user: User)");
      expect(result).toContain("updateUser(id: UserId, data: Partial<User>)");
      expect(result).toContain("deleteUser(id: UserId)");
      expect(result).toContain("getAllUsers()");
      // Check for the closing brace
      expect(result).toMatch(/}\s*$/m);
    });

    it("should get full body of an interface", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "interface User",
        symbolName: "User",
        include_body: true,
      });

      // Check that we get the full interface body
      expect(result).toContain("interface User");
      expect(result).toContain("id: UserId");
      expect(result).toContain("name: string");
      expect(result).toContain("email: string");
      expect(result).toContain("createdAt: Date");
      expect(result).toContain("}");
    });

    it("should get full body of a function", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "function processUserData",
        symbolName: "processUserData",
        include_body: true,
      });

      // Check that we get the full function body
      expect(result).toContain("function processUserData(user: User): string");
      expect(result).toContain("// Validate user data");
      expect(result).toContain("if (!user.name || !user.email)");
      expect(result).toContain('throw new Error("Invalid user data")');
      expect(result).toContain("const formatted");
      expect(result).toContain("return formatted.toUpperCase()");
      expect(result).toContain("}");
    });

    it("should get full body of an async function", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "async function fetchUserFromAPI",
        symbolName: "fetchUserFromAPI",
        include_body: true,
      });

      // Check that we get the full async function body
      expect(result).toContain(
        "async function fetchUserFromAPI(id: UserId): Promise<User | null>",
      );
      expect(result).toContain("// Simulate API call");
      expect(result).toContain("await new Promise");
      expect(result).toContain('if (id === "test-user-1")');
      expect(result).toContain("return null");
      expect(result).toContain("}");
    });

    it("should get full body of an arrow function", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "const validateEmail",
        symbolName: "validateEmail",
        include_body: true,
      });

      // Check that we get the arrow function body
      expect(result).toContain(
        "const validateEmail = (email: string): boolean =>",
      );
      expect(result).toContain("const emailRegex");
      expect(result).toContain("return emailRegex.test(email)");
    });

    it("should get full body of a type alias", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "type UserId",
        symbolName: "UserId",
        include_body: true,
      });

      // Check that we get the type definition
      expect(result).toContain("type UserId = string | number");
    });

    it("should fallback to context preview when include_body is false", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "class UserService",
        symbolName: "UserService",
        include_body: false,
        before: 2,
        after: 2,
      });

      // Should only get context lines, not the full body
      expect(result).toContain("class UserService");
      // Should not contain all methods
      expect(result).not.toContain("getAllUsers()");
    });

    it("should handle nested symbols correctly", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "getUser",
        symbolName: "getUser",
        include_body: true,
      });

      // Should get the method body
      expect(result).toContain("getUser(id: UserId): User | undefined");
      expect(result).toContain("return this.users.get(id)");
    });

    it("should handle symbols when document symbols API fails", async () => {
      // This test uses type alias line directly
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: 4, // Type alias line
        symbolName: "UserId",
        include_body: true,
        before: 1,
        after: 3,
      });

      // Should get the definition with or without full body
      expect(result).toBeDefined();
      // Should contain at least the type definition
      expect(result).toContain("type UserId = string | number");
    });

    it("should find symbol definition in the same file", async () => {
      const result = await lspGetDefinitionsTool.execute({
        root,
        filePath: "tests/fixtures/test-include-body.ts",
        line: "getUser(id: UserId)", // Line that uses UserId
        symbolName: "UserId",
        include_body: true,
      });

      // Should find the type definition
      expect(result).toContain("type UserId = string | number");
    });
  });

  describe("error handling", () => {
    it("should handle file not found", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "nonexistent-file.ts",
          line: 1,
          symbolName: "test",
        }),
      ).rejects.toThrow();
    });

    it("should handle symbol not found on line", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "tests/fixtures/test-include-body.ts",
          line: 1,
          symbolName: "NonExistentSymbol",
        }),
      ).rejects.toThrow('Symbol "NonExistentSymbol" not found on line');
    });

    it("should handle line not found", async () => {
      await expect(
        lspGetDefinitionsTool.execute({
          root,
          filePath: "tests/fixtures/test-include-body.ts",
          line: "this line does not exist in the file",
          symbolName: "User",
        }),
      ).rejects.toThrow(
        'Line containing "this line does not exist in the file" not found',
      );
    });
  });
});
