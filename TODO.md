- [x] integration: Add tests for get_definitions via MCP
  - Verify include_body behavior as well
- [x] Change tests/adapters => tests/languages. Also change vitest project to languages
  - [x] Fix CI as well
- [ ] integration: Verify if MCP tools described in README can be called individually
  - Add tests for individual MCP get_project_overview, get_definitions in tests/languages
- Regenerate lsmcp.schema.json from zod-to-jsonschema
- [ ] Expand config loading tests
  - Can presets be loaded and merged correctly?
  - Can `.lsmcp/config.json` be loaded?
  - Are items specified in `disable: ['toolName']` disabled?
  - Are additional features enabled by `experiments.*` specification?
- [ ] integration: Automatic environment detection at startup
  - Don't auto-start. Guide to corresponding preset
- [ ] Replace console.error with debugLog. Unify to not output logs unless LSMCP_DEBUG=1 is set
- [ ] Refactoring

  - [ ] Files for each language are defined in multiple places
  - [ ] Write in English except for docs/ja/. Comments too
  - [ ] Consider reducing code as much as possible within the range where tests pass

- [ ] fix: directories: [] not displayed when list_dir is not recursive
- [ ] search_for_pattern is slow. Reconsider implementation approach

---

- [ ] Composed Lsp Client: これは既存の LspClient と全く API を実装するが、初期化時に LspClient を複数束ねて、統一的にあつかう。
  - createComposedLspClient(lspClients)
- [ ] node:fs に直接アクセスしないようにして、FileSystemApi を経由するようにする
