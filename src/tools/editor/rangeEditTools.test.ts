import { describe, it, expect, beforeEach, vi } from "vitest";
import { replaceRangeTool } from "./rangeEditTools.ts";
import { readFile, writeFile } from "node:fs/promises";
import * as codeIndexer from "@internal/code-indexer";

vi.mock("node:fs/promises");
vi.mock("@internal/code-indexer");

describe("replaceRangeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should replace a single-line range", async () => {
    const mockContent = "const x = 5;\nconst y = 10;\nconst z = 15;";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 2,
      startCharacter: 6,
      endLine: 2,
      endCharacter: 7,
      newContent: "foo",
      preserveIndentation: false,
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/test/test.ts",
      "const x = 5;\nconst foo = 10;\nconst z = 15;",
      "utf-8",
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.filesChanged).toEqual(["test.ts"]);
  });

  it("should replace a multi-line range", async () => {
    const mockContent = "function test() {\n  const x = 5;\n  return x;\n}";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 2,
      startCharacter: 2,
      endLine: 3,
      endCharacter: 11,
      newContent: "const y = 10;\n  const z = x + y;\n  return z;",
      preserveIndentation: false,
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/test/test.ts",
      "function test() {\n  const y = 10;\n  const z = x + y;\n  return z;\n}",
      "utf-8",
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it("should delete content when newContent is empty", async () => {
    const mockContent = "const x = 5;\nconst y = 10;\nconst z = 15;";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 2,
      startCharacter: 0,
      endLine: 2,
      endCharacter: 13,
      newContent: "",
      preserveIndentation: false,
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/test/test.ts",
      "const x = 5;\n\nconst z = 15;",
      "utf-8",
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it("should preserve indentation when requested", async () => {
    const mockContent = "class Test {\n  method() {\n    return 1;\n  }\n}";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 3,
      startCharacter: 4,
      endLine: 3,
      endCharacter: 13,
      newContent: "const x = 5;\nreturn x;",
      preserveIndentation: true,
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/test/test.ts",
      "class Test {\n  method() {\n    const x = 5;\n    return x;\n  }\n}",
      "utf-8",
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it("should insert content at the beginning of a line", async () => {
    const mockContent = "const x = 5;\nconst y = 10;";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 2,
      startCharacter: 0,
      endLine: 2,
      endCharacter: 0,
      newContent: "// Comment\n",
      preserveIndentation: false,
    });

    expect(writeFile).toHaveBeenCalledWith(
      "/test/test.ts",
      "const x = 5;\n// Comment\nconst y = 10;",
      "utf-8",
    );

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it("should validate line numbers", async () => {
    const mockContent = "const x = 5;";
    vi.mocked(readFile).mockResolvedValue(mockContent);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 5,
      startCharacter: 0,
      endLine: 5,
      endCharacter: 0,
      newContent: "test",
      preserveIndentation: false,
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Invalid start line 5");
  });

  it("should validate character positions", async () => {
    const mockContent = "const x = 5;";
    vi.mocked(readFile).mockResolvedValue(mockContent);

    const result = await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 1,
      startCharacter: 50,
      endLine: 1,
      endCharacter: 51,
      newContent: "test",
      preserveIndentation: false,
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Invalid start character 50");
  });

  it("should mark file as modified for auto-indexing", async () => {
    const mockContent = "const x = 5;";
    vi.mocked(readFile).mockResolvedValue(mockContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await replaceRangeTool.execute({
      root: "/test",
      relativePath: "test.ts",
      startLine: 1,
      startCharacter: 6,
      endLine: 1,
      endCharacter: 7,
      newContent: "y",
      preserveIndentation: false,
    });

    expect(codeIndexer.markFileModified).toHaveBeenCalledWith(
      "/test",
      "/test/test.ts",
    );
  });
});
