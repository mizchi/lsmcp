#!/usr/bin/env node

import { spawn } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "../..");

console.log("Testing LSP server startup...");

const tsLspPath = join(
  projectRoot,
  "node_modules",
  ".bin",
  "typescript-language-server",
);
console.log(`LSP path: ${tsLspPath}`);

const lspProcess = spawn(tsLspPath, ["--stdio"], {
  cwd: __dirname,
  stdio: ["pipe", "pipe", "pipe"],
});

let stderrBuffer = "";
let stdoutBuffer = "";

lspProcess.stdout.on("data", (data) => {
  stdoutBuffer += data.toString();
  console.log("STDOUT:", data.toString());
});

lspProcess.stderr.on("data", (data) => {
  stderrBuffer += data.toString();
  console.error("STDERR:", data.toString());
});

lspProcess.on("error", (error) => {
  console.error("Process error:", error);
});

lspProcess.on("exit", (code, signal) => {
  console.log(`Process exited with code ${code}, signal ${signal}`);
  if (stderrBuffer) {
    console.log("Full stderr:", stderrBuffer);
  }
  if (stdoutBuffer) {
    console.log("Full stdout:", stdoutBuffer);
  }
});

// Send initialize request
const initRequest = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    processId: process.pid,
    rootUri: `file://${__dirname}`,
    capabilities: {},
  },
});

const message = `Content-Length: ${Buffer.byteLength(initRequest)}\r\n\r\n${initRequest}`;
console.log("Sending:", message);

setTimeout(() => {
  lspProcess.stdin.write(message);

  // Wait for response
  setTimeout(() => {
    console.log("Killing process...");
    lspProcess.kill();
  }, 2000);
}, 100);
