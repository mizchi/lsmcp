import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGitHash, getModifiedFiles, getUntrackedFiles } from "./gitUtils.ts";
import { execSync } from "child_process";
import { existsSync } from "fs";

vi.mock("child_process");
vi.mock("fs");

describe("gitUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGitHash", () => {
    it("should return hash when git command succeeds", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue("abc123def456\n");

      const result = getGitHash("/test/path");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe("abc123def456");
    });

    it("should handle timeout error", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("Command failed: ETIMEDOUT");
        throw error;
      });

      const result = getGitHash("/test/path");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("TIMEOUT");
    });

    it("should handle not git repository", () => {
      vi.mocked(existsSync).mockReturnValue(false);

      const result = getGitHash("/test/path");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("NOT_GIT_REPO");
    });
  });

  describe("getModifiedFiles", () => {
    it("should handle large number of files without crashing", () => {
      // Simulate large git diff output
      const largeOutput = Array.from(
        { length: 20000 },
        (_, i) => `M\tfile${i}.ts`,
      ).join("\n");
      vi.mocked(execSync)
        .mockReturnValueOnce(undefined) // hash check succeeds
        .mockReturnValue(
          largeOutput + "\n---SEPARATOR---\n\n---SEPARATOR---\n",
        );

      const result = getModifiedFiles("/test/path", "abc123def");

      expect(result.isOk()).toBe(true);
      const files = result._unsafeUnwrap();
      expect(files.length).toBe(20000);
    });

    it("should handle buffer overflow error", () => {
      vi.mocked(execSync)
        .mockReturnValueOnce(undefined) // hash check succeeds
        .mockImplementation(() => {
          const error = new Error("stdout maxBuffer exceeded");
          throw error;
        });

      const result = getModifiedFiles("/test/path", "abc123def");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain("Buffer overflow");
    });

    it("should combine multiple git diff outputs", () => {
      const output = `M\tfile1.ts
D\tfile2.ts
---SEPARATOR---
M\tfile3.ts
A\tfile1.ts
---SEPARATOR---
M\tfile4.ts`;

      vi.mocked(execSync)
        .mockReturnValueOnce(undefined) // hash check succeeds
        .mockReturnValue(output);

      const result = getModifiedFiles("/test/path", "abc123def");

      expect(result.isOk()).toBe(true);
      const files = result._unsafeUnwrap();
      // file1.ts appears twice but should be deduplicated
      expect(files).toContain("file1.ts");
      expect(files).toContain("file2.ts");
      expect(files).toContain("file3.ts");
      expect(files).toContain("file4.ts");
      expect(files.length).toBe(4);
    });

    it("should validate hash format", () => {
      const result = getModifiedFiles("/test/path", "abc"); // Too short

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("INVALID_HASH");
    });

    it("should detect non-existent hash", () => {
      vi.mocked(execSync)
        .mockImplementationOnce(() => {
          throw new Error("fatal: bad object abc123def");
        })
        .mockReturnValue("");

      const result = getModifiedFiles("/test/path", "abc123def");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().type).toBe("HASH_NOT_FOUND");
    });
  });

  describe("getUntrackedFiles", () => {
    it("should return list of untracked files", () => {
      vi.mocked(execSync).mockReturnValue("file1.ts\nfile2.js\nfile3.tsx\n");

      const result = getUntrackedFiles("/test/path");

      expect(result.isOk()).toBe(true);
      const files = result._unsafeUnwrap();
      expect(files).toEqual(["file1.ts", "file2.js", "file3.tsx"]);
    });

    it("should handle empty untracked files", () => {
      vi.mocked(execSync).mockReturnValue("");

      const result = getUntrackedFiles("/test/path");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([]);
    });

    it("should handle large number of untracked files", () => {
      const largeOutput = Array.from(
        { length: 10000 },
        (_, i) => `file${i}.ts`,
      ).join("\n");
      vi.mocked(execSync).mockReturnValue(largeOutput);

      const result = getUntrackedFiles("/test/path");

      expect(result.isOk()).toBe(true);
      const files = result._unsafeUnwrap();
      expect(files.length).toBe(10000);
    });
  });
});
