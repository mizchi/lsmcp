import { describe, it, expect } from "vitest";
import { uriToPath, pathToUri, normalizePath } from "./uriHelpers.ts";
import { platform } from "os";

describe("uriHelpers", () => {
  describe("uriToPath", () => {
    it("should convert file URI to path on Windows", () => {
      if (platform() === "win32") {
        expect(uriToPath("file:///C:/Users/test/file.ts")).toBe(
          "C:\\Users\\test\\file.ts",
        );
        expect(uriToPath("file:///D:/Projects/app.js")).toBe(
          "D:\\Projects\\app.js",
        );
      }
    });

    it("should convert file URI to path on Unix", () => {
      if (platform() !== "win32") {
        expect(uriToPath("file:///home/user/file.ts")).toBe(
          "/home/user/file.ts",
        );
        expect(uriToPath("file:///usr/local/bin/app")).toBe(
          "/usr/local/bin/app",
        );
      }
    });

    it("should handle spaces in paths", () => {
      if (platform() === "win32") {
        expect(uriToPath("file:///C:/Program%20Files/test.ts")).toBe(
          "C:\\Program Files\\test.ts",
        );
      } else {
        expect(uriToPath("file:///home/user%20name/file.ts")).toBe(
          "/home/user name/file.ts",
        );
      }
    });

    it("should throw error for invalid URIs", () => {
      expect(() => uriToPath("http://example.com")).toThrow("Invalid file URI");
      expect(() => uriToPath("/path/to/file")).toThrow("Invalid file URI");
    });
  });

  describe("pathToUri", () => {
    it("should convert Windows path to file URI", () => {
      if (platform() === "win32") {
        const uri = pathToUri("C:\\Users\\test\\file.ts");
        expect(uri).toMatch(/^file:\/\/\/[A-Z]:\/Users\/test\/file\.ts$/);
      }
    });

    it("should convert Unix path to file URI", () => {
      if (platform() !== "win32") {
        expect(pathToUri("/home/user/file.ts")).toBe(
          "file:///home/user/file.ts",
        );
      }
    });

    it("should handle spaces in paths", () => {
      if (platform() === "win32") {
        const uri = pathToUri("C:\\Program Files\\test.ts");
        expect(uri).toMatch(/^file:\/\/\/[A-Z]:\/Program%20Files\/test\.ts$/);
      } else {
        expect(pathToUri("/home/user name/file.ts")).toBe(
          "file:///home/user%20name/file.ts",
        );
      }
    });
  });

  describe("normalizePath", () => {
    it("should normalize Windows paths", () => {
      if (platform() === "win32") {
        expect(normalizePath("C:\\Users\\test\\file.ts")).toBe(
          "C:/Users/test/file.ts",
        );
        expect(normalizePath("c:\\Users\\test\\file.ts")).toBe(
          "C:/Users/test/file.ts",
        );
      }
    });

    it("should normalize Unix paths", () => {
      expect(normalizePath("/home/user/file.ts")).toBe("/home/user/file.ts");
    });

    it("should handle mixed separators", () => {
      expect(normalizePath("C:\\Users/test\\sub/file.ts")).toBe(
        "C:/Users/test/sub/file.ts",
      );
    });
  });
});
