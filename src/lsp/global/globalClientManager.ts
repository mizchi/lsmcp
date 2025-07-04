/**
 * Global LSP client management
 */

import type { LSPClient } from "../lspTypes.ts";

// Global state for active LSP client
let activeClient: LSPClient | null = null;

/**
 * Set and initialize the LSP client
 */
export async function initialize(client: LSPClient): Promise<LSPClient> {
  if (activeClient) {
    await activeClient.stop();
  }

  activeClient = client;
  await activeClient.start();
  return activeClient;
}

/**
 * Get the active LSP client
 */
export function getActiveClient(): LSPClient {
  if (!activeClient) {
    throw new Error(
      "LSP client not initialized. Please call initialize() first.",
    );
  }
  return activeClient;
}

/**
 * Set the active LSP client (for testing)
 */
export function setActiveClient(client: LSPClient | null): void {
  activeClient = client;
}

/**
 * Shutdown the active LSP client
 */
export async function shutdown(): Promise<void> {
  if (activeClient) {
    await activeClient.stop();
    activeClient = null;
  }
}

/**
 * Get the LSP client if available (backwards compatibility)
 */
export function getLSPClient(): LSPClient | null {
  return activeClient;
}

/**
 * Get language ID from file path
 */
export function getLanguageIdFromPath(filePath: string): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    fs: "fsharp",
    fsx: "fsharp",
    fsi: "fsharp",
    ml: "ocaml",
    mli: "ocaml",
    rb: "ruby",
    php: "php",
    lua: "lua",
    dart: "dart",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    r: "r",
    jl: "julia",
    nim: "nim",
    zig: "zig",
    v: "vlang",
    sh: "shellscript",
    bash: "shellscript",
    zsh: "shellscript",
    fish: "shellscript",
    ps1: "powershell",
    psm1: "powershell",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    jsonc: "jsonc",
    xml: "xml",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    md: "markdown",
    markdown: "markdown",
    tex: "latex",
    bib: "bibtex",
    sql: "sql",
    toml: "toml",
    ini: "ini",
    cfg: "ini",
    conf: "ini",
    vb: "vb",
    clj: "clojure",
    cljs: "clojurescript",
    cljc: "clojure",
    elm: "elm",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    hrl: "erlang",
    vue: "vue",
    svelte: "svelte",
  };

  return languageMap[ext || ""] || null;
}
