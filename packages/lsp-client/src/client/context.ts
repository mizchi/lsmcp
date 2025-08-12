/**
 * LSP Client context for dependency injection
 */

import type { LSPClient } from "../core/client.ts";

/**
 * LSP client context interface
 */
export interface LSPClientContext {
  client: LSPClient;
  getLanguageId?: (filePath: string) => string | null;
}

/**
 * Create a new LSP client context
 */
export function createLSPClientContext(client: LSPClient): LSPClientContext {
  return {
    client,
    getLanguageId: getLanguageIdFromPath,
  };
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
