/**
 * Tests for multi-language external library providers
 */

import { describe, it, expect, beforeAll } from "vitest";
import { RustExternalLibraryProvider } from "./rustExternalLibraryProviderImpl.ts";
import { GoExternalLibraryProvider } from "./goExternalLibraryProviderImpl.ts";
import {
  parseCargoToml,
  parseRustImports,
} from "./rustExternalLibraryProvider.ts";
import {
  parseGoMod,
  parseGoImports,
  classifyGoImport,
} from "./goExternalLibraryProvider.ts";
import { mkdtemp, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("Multi-Language External Library Providers", () => {
  describe("Rust Provider", () => {
    let tempDir: string;
    let rustProvider: RustExternalLibraryProvider;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "rust-test-"));
      rustProvider = new RustExternalLibraryProvider();
    });

    it("should detect Rust projects", async () => {
      // Create Cargo.toml
      await writeFile(
        join(tempDir, "Cargo.toml"),
        `[package]
name = "test-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
`,
      );

      const canHandle = await rustProvider.canHandle(tempDir);
      expect(canHandle).toBe(true);
    });

    it("should parse Cargo.toml dependencies", async () => {
      const deps = await parseCargoToml(tempDir);

      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe("serde");
      expect(deps[0].version).toBe("1.0");
      expect(deps[1].name).toBe("tokio");
      expect(deps[1].version).toBe("1.0");
    });

    it("should parse Rust imports", () => {
      const code = `
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use tokio::runtime::Runtime;
use crate::utils::helper;

extern crate regex;
`;

      const imports = parseRustImports(code);

      // Should only include external crates (not std or crate)
      expect(imports.some((i) => i.crateName === "serde")).toBe(true);
      expect(imports.some((i) => i.crateName === "tokio")).toBe(true);
      expect(imports.some((i) => i.crateName === "regex")).toBe(true);
      expect(imports.some((i) => i.crateName === "std")).toBe(false);
      expect(imports.some((i) => i.crateName === "crate")).toBe(false);
    });

    it("should parse imports from Rust provider", () => {
      const code = `use serde::Serialize;`;
      const imports = rustProvider.parseImports(code, "test.rs");

      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe("serde");
      expect(imports[0].symbols).toContain("Serialize");
    });
  });

  describe("Go Provider", () => {
    let tempDir: string;
    let goProvider: GoExternalLibraryProvider;

    beforeAll(async () => {
      tempDir = await mkdtemp(join(tmpdir(), "go-test-"));
      goProvider = new GoExternalLibraryProvider();
    });

    it("should detect Go projects", async () => {
      // Create go.mod
      await writeFile(
        join(tempDir, "go.mod"),
        `module github.com/user/project

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/stretchr/testify v1.8.4 // indirect
)
`,
      );

      const canHandle = await goProvider.canHandle(tempDir);
      expect(canHandle).toBe(true);
    });

    it("should parse go.mod dependencies", async () => {
      const goMod = await parseGoMod(tempDir);

      expect(goMod).not.toBeNull();
      expect(goMod!.module).toBe("github.com/user/project");
      expect(goMod!.go).toBe("1.21");
      expect(goMod!.require).toHaveLength(2);

      expect(goMod!.require![0].path).toBe("github.com/gin-gonic/gin");
      expect(goMod!.require![0].version).toBe("v1.9.1");
      expect(goMod!.require![0].indirect).toBeFalsy();

      expect(goMod!.require![1].path).toBe("github.com/stretchr/testify");
      expect(goMod!.require![1].indirect).toBe(true);
    });

    it("should parse Go imports", () => {
      const code = `
package main

import (
    "fmt"
    "net/http"
    
    "github.com/gin-gonic/gin"
    middleware "github.com/gin-gonic/gin/middleware"
    . "github.com/stretchr/testify/assert"
)

import "context"
`;

      const imports = parseGoImports(code);

      expect(imports).toContainEqual({ path: "fmt", alias: undefined });
      expect(imports).toContainEqual({ path: "net/http", alias: undefined });
      expect(imports).toContainEqual({
        path: "github.com/gin-gonic/gin",
        alias: undefined,
      });
      expect(imports).toContainEqual({
        path: "github.com/gin-gonic/gin/middleware",
        alias: "middleware",
      });
      expect(imports).toContainEqual({
        path: "github.com/stretchr/testify/assert",
        alias: ".",
      });
      expect(imports).toContainEqual({ path: "context", alias: undefined });
    });

    it("should classify Go imports correctly", () => {
      const currentModule = "github.com/user/project";

      expect(classifyGoImport("fmt", currentModule)).toBe("stdlib");
      expect(classifyGoImport("net/http", currentModule)).toBe("stdlib");
      expect(classifyGoImport("github.com/gin-gonic/gin", currentModule)).toBe(
        "external",
      );
      expect(
        classifyGoImport("github.com/user/project/utils", currentModule),
      ).toBe("internal");
      expect(classifyGoImport("internal/config", currentModule)).toBe("stdlib");
    });

    it("should get dependencies from Go provider", async () => {
      const deps = await goProvider.getDependencies(tempDir);

      expect(deps).toHaveLength(2);
      expect(deps[0].name).toBe("github.com/gin-gonic/gin");
      expect(deps[0].isDirect).toBe(true);
      expect(deps[1].name).toBe("github.com/stretchr/testify");
      expect(deps[1].isDirect).toBe(false);
    });
  });

  describe("Provider Detection", () => {
    it("should detect Rust project", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "detect-rust-"));
      await writeFile(join(tempDir, "Cargo.toml"), '[package]\nname = "test"');

      const rustProvider = new RustExternalLibraryProvider();
      expect(await rustProvider.canHandle(tempDir)).toBe(true);

      const goProvider = new GoExternalLibraryProvider();
      expect(await goProvider.canHandle(tempDir)).toBe(false);
    });

    it("should detect Go project", async () => {
      const tempDir = await mkdtemp(join(tmpdir(), "detect-go-"));
      await writeFile(join(tempDir, "go.mod"), "module test\n\ngo 1.21");

      const goProvider = new GoExternalLibraryProvider();
      expect(await goProvider.canHandle(tempDir)).toBe(true);

      const rustProvider = new RustExternalLibraryProvider();
      expect(await rustProvider.canHandle(tempDir)).toBe(false);
    });
  });
});
