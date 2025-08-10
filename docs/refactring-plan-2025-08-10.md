# lsmcp リファクタリング指針（2025-08-10）

この文書は、現行実装・テスト・ドキュメントの突き合わせ結果を踏まえた、今後のリファクタリング計画を示す。非互換リスクを抑えつつ、モジュール境界の明確化、命名規約の一貫化、設定スキーマの整合性向上を優先する。

## 背景（現状整理）

- ツール命名
  - 実装の ToolDef.name は snake_case（例: `get_hover`, `search_symbol_from_index`）。一部クライアント UI では `mcp__lsmcp__get_hover` のようにサーバ修飾が付与されるが、これは表示用であり実名ではない。
  - ドキュメントを実装に合わせて是正済み（参照: [`docs/TOOL_REFERENCE.md`](docs/TOOL_REFERENCE.md)）。
- モジュール境界
  - LSP 共通ツール: [`src/lsp/tools/`](src/lsp/tools)
  - Index/Project ツール: [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts), [`src/mcp/tools/indexToolsUnified.ts`](src/mcp/tools/indexToolsUnified.ts), [`src/mcp/tools/projectOverview.ts`](src/mcp/tools/projectOverview.ts)
  - Serenity ツール集約: [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)
  - TypeScript 特化: [`src/mcp/tools/externalLibraryTools.ts`](src/mcp/tools/externalLibraryTools.ts), [`src/mcp/tools/symbolResolverTools.ts`](src/mcp/tools/symbolResolverTools.ts)
- 設定スキーマ
  - インデクサは `.lsmcp/config.json` を読み、`indexFiles`/`settings`/`symbolFilter` を解釈する（参照: [`src/indexer/config/configLoader.ts`](src/indexer/config/configLoader.ts), [`src/indexer/config/config.ts`](src/indexer/config/config.ts)）。
  - ドキュメントに `symbolFilter` を追記済み（参照: [`docs/config-schema.md`](docs/config-schema.md)）。
- 軽微な境界の曖昧さ
  - registry 内の `serenityToolsList` 再定義と、正規の `getSerenityToolsList`（[`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)）が並存（参照: [`src/mcp/registry/toolRegistry.ts`](src/mcp/registry/toolRegistry.ts)）。現状は `lspServerRunner` が `getSerenityToolsList` を使用しており、機能衝突はない。

## 目的

- モジュール境界・依存の向きを明確化し、単一の権威（single source of truth）を確立
- ドキュメントと実装の恒常的一致を保つためのテスト・仕組みを追加
- 設定スキーマ（インデクサ/ランタイム）の責務境界を明文化
- 後方互換性を維持しつつ段階的にレガシー経路を縮退

## フェーズ分割

### フェーズ 1（短期・非破壊）

- [ ] registry の Serenity ツール出所の一本化（設計）
  - 現状: `serenityToolsList` が [`src/mcp/registry/toolRegistry.ts`](src/mcp/registry/toolRegistry.ts) にも再定義されている。
  - 方針: `toolRegistry` から `serenityToolsList` 再定義を撤去し、`getSerenityToolsList`（[`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)）のみを用いるように統一。
  - 手順:
    - [ ] `toolRegistry` での `serenityToolsList` エクスポートを非推奨化（JSDoc @deprecated）
    - [ ] 参照箇所を探索し、`getSerenityToolsList` に移行（優先: [`src/mcp/server/lspServerRunner.ts`](src/mcp/server/lspServerRunner.ts) はすでに OK）
    - [ ] 互換期を経て削除
- [ ] メモリ機能ドキュメントの将来オプション注記
  - `reportRetentionDays` / `autoGenerateOnMerge` / `defaultIncludeAI` は実装側の参照経路が未確認。`memoryAdvanced` は実装・スキーマ・起動系で有効（参照: [`src/mcp/tools/advancedMemoryTools.ts`](src/mcp/tools/advancedMemoryTools.ts), [`src/config/schema/configSchema.ts`](src/config/schema/configSchema.ts)）。
  - 方針: 将来計画のオプションである旨を明記し、現在は `memoryAdvanced` のみが有効設定であることを明示。
  - 対象: [`docs/memory-report-system.md`](docs/memory-report-system.md), [`docs/memory-report-system-ja.md`](docs/memory-report-system-ja.md)
- [ ] ツール名・公開可否のスナップショットテスト追加
  - 目的: ドキュメント乖離の早期検知
  - テスト案:
    - [ ] `getSerenityToolsList()` が返す `.name` 一覧のスナップショット
    - [ ] `highLevelTools`（[`src/mcp/registry/toolRegistry.ts`](src/mcp/registry/toolRegistry.ts)）の `.name` 一覧のスナップショット
    - [ ] LSP ツール（`lspTools`）の `.name` 一覧のスナップショット
- [ ] README の命名注記の補強
  - 既に注意書きを追加済み（`mcp__lsmcp__` は表示上の修飾）。`CLAUDE.md` へのリンク・脚注を追加。

### フェーズ 2（中期・低リスク）

- [ ] MCP サーバ組み立て経路の明確化・依存の逆転
  - 目的: `toolRegistry` と `tools/index.ts` の責務を整理し、依存方向の循環を回避
  - 方針:
    - [ ] 「ツール定義群（pure）」と「登録/フィルタリング（infrastructure）」を分離
    - [ ] Capability/Unsupported フィルタ（[`src/mcp/registry/capabilityFilter.ts`](src/mcp/registry/capabilityFilter.ts)）の適用位置を統一
- [ ] JSON Schema（`lsmcp.schema.json`）とドキュメントの同期パイプライン
  - 目的: ドキュメント → スキーマ → 実装の乖離を CI で検出
  - 方針:
    - [ ] `lsmcp.schema.json` と [`docs/config-schema.md`](docs/config-schema.md) の主要キー集合・既定値の整合チェックを CI へ追加
    - [ ] 差分検出時に警告を出して PR 上で可視化

### フェーズ 3（長期・機能拡張）

- [ ] 複数アダプタ/ディレクトリ別アダプタへの布石
  - ドキュメント記載の将来計画（複数アダプタ/ディレクトリ別アダプタ/動的切替）に向け、設定モデルをモジュール化
  - 設計検討: アダプタ単位で indexer 設定のスコープを切る際の衝突回避
- [ ] プロジェクト健全性メトリクスの標準化
  - `get_project_overview` の拡張（メトリクス列挙/しきい値）
  - CI でのベースライン比較（例: 週次）

## 設計原則

- Single Source of Truth（SSOT）
  - Serenity ツールの出所は [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts) に一本化
  - Index/Project ツールは [`src/mcp/tools/indexTools.ts`](src/mcp/tools/indexTools.ts) に集約
- 最小驚き（Least Surprise）
  - ドキュメントのツール名は実装の `ToolDef.name` と一致
  - UI 表示修飾（`mcp__lsmcp__*`）は注記に留める
- 段階的移行（Deprecation Policy）
  - 非推奨 API は 2 リリース分を目安に移行案内 → 削除

## 成果物と完了条件（DoD）

- フェーズ 1
  - [ ] `toolRegistry` における `serenityToolsList` 再定義の非推奨化（JSDoc・CHANGELOG 記載）
  - [ ] メモリドキュメントの将来オプション注記反映
  - [ ] ツール名/公開可否スナップショットテストの導入（`vitest`）
  - [ ] README/CLAUDE.md の命名注記リンク補強
- フェーズ 2
  - [ ] MCP 登録経路の責務整理（設計/PR）
  - [ ] スキーマとドキュメントの自動整合性チェック（CI）
- フェーズ 3
  - [ ] 拡張に向けた設定モデル案（ADR 形式の設計メモ）

## 影響範囲とリスク

- 影響ファイル（例）
  - [`src/mcp/registry/toolRegistry.ts`](src/mcp/registry/toolRegistry.ts)
  - [`src/mcp/tools/index.ts`](src/mcp/tools/index.ts)
  - [`src/mcp/server/lspServerRunner.ts`](src/mcp/server/lspServerRunner.ts)
  - ドキュメント: [`README.md`](README.md), [`CLAUDE.md`](CLAUDE.md), [`docs/TOOL_REFERENCE.md`](docs/TOOL_REFERENCE.md), [`docs/config-schema.md`](docs/config-schema.md), `docs/memory-report-system*.md`
- リスク
  - 後方互換性: `serenityToolsList` の直接参照削除タイミング
  - 認知負荷: ドキュメントの変更頻度と同期コスト

## 計画スケジュール（目安）

- フェーズ 1: 1〜2 日
- フェーズ 2: 3〜5 日（設計 → 実装 →CI）
- フェーズ 3: 以降スプリント計画に合流

## トラッキング

- タスクは GitHub Issues/PR に分割し、各フェーズの DoD を満たしたらクローズ
- テストスナップショットが変化した場合、PR に差分を明記（変更理由のテンプレート化）

## 付録：現状の公開 API（抜粋）

- LSP 共通（例）
  - `get_hover`（[`src/lsp/tools/hover.ts`](src/lsp/tools/hover.ts)）
  - `find_references`（[`src/lsp/tools/references.ts`](src/lsp/tools/references.ts)）
  - `get_definitions`（[`src/lsp/tools/definitions.ts`](src/lsp/tools/definitions.ts)）
- Index/Project（例）
  - `index_symbols`（[`src/mcp/tools/indexToolsUnified.ts`](src/mcp/tools/indexToolsUnified.ts)）
  - `get_project_overview`（[`src/mcp/tools/projectOverview.ts`](src/mcp/tools/projectOverview.ts)）
- Serenity（例）
  - `replace_symbol_body`（[`src/mcp/tools/symbolEditTools.ts`](src/mcp/tools/symbolEditTools.ts)）
  - `replace_regex`（[`src/mcp/tools/regexEditTools.ts`](src/mcp/tools/regexEditTools.ts)）
