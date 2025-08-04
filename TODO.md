# LSMCP TODO List

## 命名規則リファクタリング計画

### 🎯 Phase 1: ファイル命名の統一 (優先度: 高)

#### LSPツールファイルの命名統一
- [x] `src/lsp/tools/lspGetDefinitions.ts` → `src/lsp/tools/definitions.ts`
- [x] `src/lsp/tools/lspFindReferences.ts` → `src/lsp/tools/references.ts`
- [x] `src/lsp/tools/lspGetHover.ts` → `src/lsp/tools/hover.ts`
- [x] `src/lsp/tools/lspGetDiagnostics.ts` → `src/lsp/tools/diagnostics.ts`
- [x] `src/lsp/tools/lspGetAllDiagnostics.ts` → `src/lsp/tools/allDiagnostics.ts`
- [x] `src/lsp/tools/lspRenameSymbol.ts` → `src/lsp/tools/rename.ts`
- [x] `src/lsp/tools/lspDeleteSymbol.ts` → `src/lsp/tools/deleteSymbol.ts`
- [x] `src/lsp/tools/lspGetCompletion.ts` → `src/lsp/tools/completion.ts`
- [x] `src/lsp/tools/lspGetSignatureHelp.ts` → `src/lsp/tools/signatureHelp.ts`
- [x] `src/lsp/tools/lspFormatDocument.ts` → `src/lsp/tools/formatting.ts`
- [x] `src/lsp/tools/lspGetCodeActions.ts` → `src/lsp/tools/codeActions.ts`
- [x] `src/lsp/tools/lspGetDocumentSymbols.ts` → `src/lsp/tools/documentSymbols.ts`
- [x] `src/lsp/tools/lspGetWorkspaceSymbols.ts` → `src/lsp/tools/workspaceSymbols.ts`
- [x] `src/lsp/tools/lspCheckCapabilities.ts` → `src/lsp/tools/checkCapabilities.ts`
- [x] `src/lsp/tools/lspExportDebugSession.ts` → `src/lsp/tools/exportDebugSession.ts`
- [x] `src/lsp/tools/lspValidateAdapter.ts` → `src/lsp/tools/validateAdapter.ts`
- [x] toolRegistry.ts のimport文を更新
- [x] 統合テストのimport文を更新

#### アダプターファイルの命名統一
- [x] `src/adapters/typescript-language-server.ts` → `src/adapters/typescriptLanguageServer.ts`
- [x] `src/adapters/rust-analyzer.ts` → `src/adapters/rustAnalyzer.ts`
- [x] 対応する import 文の更新

### 🎯 Phase 2: 型定義の整理 (優先度: 中)

#### 型定義ディレクトリの作成
- [ ] `src/types/` ディレクトリを作成
- [ ] `src/types/lsp.ts` - LSP関連型を集約
- [ ] `src/types/mcp.ts` - MCP関連型を集約
- [ ] `src/types/config.ts` - 設定関連型を集約
- [ ] `src/types/index.ts` - 再エクスポート用

#### 既存型定義の移行
- [ ] `src/core/pure/types.ts` から共通型を移行
- [ ] `src/lsp/lspTypes.ts` から LSP 型を移行
- [ ] `src/core/config/configSchema.ts` から設定型を移行
- [ ] 重複する型定義の統合

### 🎯 Phase 3: 定数の整理 (優先度: 中)

#### 定数ディレクトリの作成
- [ ] `src/constants/` ディレクトリを作成
- [ ] `src/constants/server.ts` - サーバー設定定数
- [ ] `src/constants/symbols.ts` - シンボル種別定数
- [ ] `src/constants/defaults.ts` - デフォルト値
- [ ] `src/constants/index.ts` - 再エクスポート

#### 定数命名の統一
- [ ] すべての定数を UPPER_SNAKE_CASE に統一
- [ ] DEFAULT_ プレフィックスの一貫した使用

### 🎯 Phase 4: 関数・変数命名の改善 (優先度: 低)

#### Tool 関数のプレフィックス削除
- [ ] `lspGetDefinitionsTool` → `getDefinitionsTool`
- [ ] `lspFindReferencesTool` → `findReferencesTool`
- [ ] 他の LSP ツール関数も同様に更新

#### インターフェース名の重複解消
- [ ] 重複する `Result` インターフェースに具体的な名前を付与
- [ ] 重複する `Options` インターフェースに具体的な名前を付与

### 🎯 Phase 5: テストとドキュメントの更新 (優先度: 高)

#### テストの更新
- [ ] リネーム後のファイルに対するテストの import を更新
- [ ] すべてのテストが通ることを確認

#### ドキュメントの更新
- [ ] README.md のファイルパスを更新
- [ ] API ドキュメントの更新
- [ ] CLAUDE.md の命名規則セクションを更新

### 🎯 Phase 6: 破壊的変更の対応 (優先度: 最高)

#### 外部API の互換性維持
- [x] MCP ツール名は変更しない（後方互換性のため）
  - 確認済み: ツール名は既に `get_definitions` 形式で、ファイル名とは独立
- [ ] エクスポートされる関数名の変更は慎重に検討
  - 内部関数名（`lspGetDefinitionsTool`）は変更可能だが、import への影響を考慮
- [ ] 必要に応じて非推奨警告を追加

## 実装順序

1. **Week 1**: Phase 6（互換性の検討）→ Phase 1（ファイル命名）
2. **Week 2**: Phase 2（型定義）→ Phase 3（定数）
3. **Week 3**: Phase 4（関数・変数）→ Phase 5（テスト・ドキュメント）

## 注意事項

- 各フェーズ完了後に必ずテストを実行
- git でブランチを分けて作業（例: `refactor/naming-conventions-phase-1`）
- 大きな変更は PR でレビュー
- ユーザーへの影響を最小限に抑える

## 将来的な検討事項

### 複数 LSP プロセスのサポート
- [ ] config.json で複数の adapter を定義可能にする
- [ ] ファイルタイプに基づく動的アダプター切り替え
- [ ] プロジェクト内の異なるディレクトリで異なる LSP を使用

### パフォーマンス最適化
- [ ] シンボルインデックスの増分更新の改善
- [ ] メモリ使用量の最適化
- [ ] 並列処理の強化