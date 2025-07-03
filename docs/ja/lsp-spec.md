# Language Server Protocol 仕様書

このドキュメントは Language Server Protocol（LSP）の 3.17.x バージョンについて説明しています。

## 概要

Language Server Protocol（LSP）は、Microsoft が開発したプロトコルで、プログラミング言語の言語サーバーとエディタ・IDE の間のコミュニケーションを標準化するものです。

## 主な特徴

- **言語に依存しない**: 複数のプログラミング言語をサポート
- **エディタに依存しない**: 様々なエディタや IDE で利用可能
- **標準化されたAPI**: 一貫したインターフェースを提供

## 基本プロトコル

### ヘッダー部分

プロトコルは HTTP と同様に、ヘッダーとコンテンツ部分から構成されます。

サポートされているヘッダーフィールド：

| ヘッダーフィールド名 | 値の型 | 説明 |
| --- | --- | --- |
| Content-Length | number | コンテンツ部分のバイト長。必須。 |
| Content-Type | string | コンテンツ部分の MIME タイプ。デフォルトは application/vscode-jsonrpc; charset=utf-8 |

### コンテンツ部分

メッセージの実際のコンテンツが含まれます。JSON-RPC を使用してリクエスト、レスポンス、通知を記述します。

### 例

```
Content-Length: ...\r\n
\r\n
{
	"jsonrpc": "2.0",
	"id": 1,
	"method": "textDocument/completion",
	"params": {
		...
	}
}
```

## 主要な機能

### テキストドキュメント機能

- **補完（Completion）**: コード補完機能
- **ホバー（Hover）**: シンボルの詳細情報表示
- **定義へのジャンプ（Go to Definition）**: シンボルの定義場所への移動
- **参照の検索（Find References）**: シンボルの参照箇所の検索
- **診断（Diagnostics）**: エラーや警告の表示

### ワークスペース機能

- **シンボル検索**: ワークスペース内のシンボルの検索
- **ファイル監視**: ファイルの変更を監視
- **設定管理**: 設定の変更を通知

## 使用例

lsmcp では、LSP を使用して以下のような機能を提供しています：

1. **診断情報の取得**: `get_diagnostics` でエラーや警告を取得
2. **シンボル情報の取得**: `get_document_symbols` でドキュメント内のシンボルを取得
3. **ホバー情報の取得**: `get_hover` でシンボルの詳細情報を取得
4. **定義の取得**: `get_definitions` でシンボルの定義を取得
5. **参照の検索**: `find_references` でシンボルの参照を検索

## 対応言語

lsmcp は以下の言語をサポートしています：

- TypeScript/JavaScript
- Python
- Go
- F#
- MoonBit
- その他多数

## 詳細仕様

完全な仕様については、[Microsoft の公式仕様書](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)を参照してください。

## リソース

- [Language Server Protocol 公式サイト](https://microsoft.github.io/language-server-protocol/)
- [VS Code Language Server Extension ガイド](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [LSP 実装例](https://github.com/Microsoft/vscode-languageserver-node)