# lsmcp - Language Service MCP

統一された Language Server Protocol (LSP) ツールを Model Context Protocol (MCP) として提供します。TypeScript/JavaScript には Compiler API を使用した高度なサポートがあります。

## 主な機能

- 🌍 **マルチ言語サポート** - TypeScript/JavaScript はビルトイン、LSP 経由で任意の言語をサポート
- 🔍 **セマンティックなコード解析** - 定義へジャンプ、参照検索、型情報取得
- ♻️ **インテリジェントなリファクタリング** - シンボルのリネーム、ファイル移動、自動インポート更新
- 🔧 **柔軟な設定** - `--bin` オプションで任意の LSP サーバーを使用可能
- 🤖 **AI 最適化** - 行番号とシンボルベースのインターフェースで LLM に最適化
- ⚡ **高速シンボル検索** - リアルタイムファイル監視によるプロジェクト全体のシンボルインデックス
- 🎯 **スマートなインポート提案** - 相対パスで import 候補を検索・提案

## インストール

### TypeScript/JavaScript

```bash
claude mcp add npx -- -y @mizchi/lsmcp --language=typescript
```

### その他の言語

```bash
# Rust
claude mcp add npx -- -y @mizchi/lsmcp --bin="rust-analyzer"

# Python
claude mcp add npx -- -y @mizchi/lsmcp --bin="pylsp"

# Go
claude mcp add npx -- -y @mizchi/lsmcp --bin="gopls"

# C/C++
claude mcp add npx -- -y @mizchi/lsmcp --bin="clangd"
```

## 使用方法

### TypeScript/JavaScript プロジェクト

TypeScript プロジェクトでは、以下の特別なツールが使用できます：

| タスク                           | ツール                           | 説明                                         |
| ------------------------------ | ------------------------------ | -------------------------------------------- |
| シンボル検索                     | `lsmcp_search_symbols`         | プロジェクト全体の高速シンボル検索              |
| 型情報取得                      | `lsmcp_get_type_at_symbol`     | Compiler API を使用した詳細な型情報            |
| モジュールのエクスポート一覧      | `lsmcp_get_module_symbols`     | モジュールからすべてのエクスポートをリスト       |
| シンボルのリネーム               | `lsmcp_rename_symbol`          | インポート更新を含むセマンティックリネーム       |
| ファイル移動                    | `lsmcp_move_file`              | 自動インポート更新付きの移動                   |
| インポート候補検索               | `lsmcp_find_import_candidates` | シンボルをインポートできる場所を提案            |

### すべての言語（LSP 経由）

LSP サポートがある任意の言語で使用可能：

| タスク                    | ツール                      | 説明                        |
| ----------------------- | ------------------------- | -------------------------- |
| 参照検索                 | `lsp_find_references`     | シンボルのすべての使用箇所を検索 |
| 定義へジャンプ            | `lsp_get_definitions`     | シンボル定義へジャンプ          |
| エラーチェック            | `lsp_get_diagnostics`     | エラーと警告を取得             |
| シンボルリネーム          | `lsp_rename_symbol`       | プロジェクト全体でリネーム      |
| ホバー情報               | `lsp_get_hover`           | ドキュメントと型情報           |
| コードフォーマット        | `lsp_format_document`     | 言語ルールに従ってフォーマット   |

## 開発スタック

- pnpm: パッケージマネージャー
- typescript: コア言語
- ts-morph: TypeScript AST 操作
- tsdown: Rolldown ベースのバンドラー
- @modelcontextprotocol/sdk: MCP 実装
- vscode-languageserver-protocol: LSP クライアント実装

## コーディングルール

- ファイル名: snake_case
- import に `.ts` 拡張子を追加（例: `import {} from "./x.ts"`）- Deno 互換性のため

## 行ベースのインターフェース設計

AI はワードカウントが苦手なので、LSP の Line Character ではなく、一致する行と、一致するコードでインターフェースを調整する必要があります。すべてのツールは以下の方式を採用：

- `line`: 行番号（1-based）または行内の文字列マッチング
- `symbolName`: シンボル名での指定
- Character offset は使用しない

## シンボルインデックスアーキテクチャ

- ファイル変更を自動検知して更新
- プロジェクト全体のシンボルを高速検索
- ts-morph のプロジェクトインスタンスをキャッシュ

## ツールカテゴリ

### TypeScript 特有のツール（Compiler API）

これらのツールは TypeScript Compiler API を直接使用し、`--language typescript` でのみ利用可能：

- `lsmcp_move_file`, `lsmcp_move_directory` - インポート更新付きの移動
- `lsmcp_rename_symbol`, `lsmcp_delete_symbol` - TypeScript Compiler API を使用したセマンティックリファクタリング
- `lsmcp_get_type_at_symbol`, `lsmcp_get_module_symbols` - 高度な型解析
- `lsmcp_search_symbols`, `lsmcp_find_import_candidates` - 高速シンボルインデックス
- `lsmcp_get_symbols_in_scope` - スコープ認識シンボル解析

### LSP ベースツール（全言語）

これらのツールは LSP サーバーがある任意の言語で動作：

- `lsp_get_hover`, `lsp_find_references`, `lsp_get_definitions` - ナビゲーションと情報
- `lsp_get_diagnostics` - エラーチェックと警告
- `lsp_rename_symbol`, `lsp_delete_symbol` - リファクタリング操作
- `lsp_get_document_symbols`, `lsp_get_workspace_symbols` - シンボルリスト
- `lsp_get_completion`, `lsp_get_signature_help` - コード補完
- `lsp_get_code_actions`, `lsp_format_document` - コード修正とフォーマット

注: `--language typescript` を使用すると、LSP と TypeScript 特有の両方のツールが利用可能です。