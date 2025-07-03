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

## プロトコル詳細

### メッセージ構造

LSP は JSON-RPC 2.0 をベースとしており、以下のメッセージ形式をサポートしています：

#### リクエストメッセージ
```typescript
interface RequestMessage {
    jsonrpc: string;    // 常に "2.0"
    id: integer | string;
    method: string;
    params?: array | object;
}
```

#### レスポンスメッセージ
```typescript
interface ResponseMessage {
    jsonrpc: string;
    id: integer | string | null;
    result?: any;       // 成功時のみ
    error?: ResponseError;  // エラー時のみ
}
```

#### 通知メッセージ
```typescript
interface NotificationMessage {
    jsonrpc: string;
    method: string;
    params?: array | object;
}
```

### エラーコード

LSP では以下のエラーコードが定義されています：

| コード | 名前 | 説明 |
|--------|------|------|
| -32700 | ParseError | パース エラー |
| -32600 | InvalidRequest | 不正なリクエスト |
| -32601 | MethodNotFound | メソッドが見つからない |
| -32602 | InvalidParams | 不正なパラメータ |
| -32603 | InternalError | 内部エラー |
| -32002 | ServerNotInitialized | サーバーが初期化されていない |
| -32800 | RequestCancelled | リクエストがキャンセルされた |
| -32801 | ContentModified | コンテンツが変更された |

### 機能（Capabilities）

クライアントとサーバーは、初期化時に対応している機能を交換します。これにより、利用可能な機能を動的に決定できます。

#### 主要な機能カテゴリ

1. **テキストドキュメント機能**
   - 補完（textDocument/completion）
   - ホバー（textDocument/hover）
   - 署名ヘルプ（textDocument/signatureHelp）
   - 定義へのジャンプ（textDocument/definition）
   - 参照の検索（textDocument/references）
   - ドキュメントハイライト（textDocument/documentHighlight）
   - ドキュメントシンボル（textDocument/documentSymbol）
   - コードアクション（textDocument/codeAction）
   - 診断（textDocument/publishDiagnostics）

2. **ワークスペース機能**
   - ワークスペースシンボル（workspace/symbol）
   - ファイル監視（workspace/didChangeWatchedFiles）
   - 設定変更（workspace/didChangeConfiguration）

### 進捗レポート

LSP 3.15.0 以降、進捗レポート機能がサポートされています：

```typescript
interface ProgressParams<T> {
    token: ProgressToken;
    value: T;
}
```

### キャンセル機能

長時間実行されるリクエストは、キャンセル通知を送信することで中断できます：

```typescript
interface CancelParams {
    id: integer | string;
}
```

### URI 処理

LSP では URI（Uniform Resource Identifier）を文字列として転送します。適切なエンコーディングとパス処理が重要です。

例：
```
file:///c:/project/readme.md
file:///C%3A/project/readme.md
```

### 正規表現サポート

LSP では ECMAScript 正規表現仕様をベースとした正規表現をサポートしています。クライアントは使用する正規表現エンジンを宣言する必要があります。

## lsmcp での実装

lsmcp では、以下のような実装パターンを使用しています：

1. **アダプターパターン**: 各言語の LSP サーバーに対応するアダプターを実装
2. **診断情報の統一**: 複数の言語から一貫した診断情報を提供
3. **非同期処理**: 長時間実行される操作の適切な処理
4. **エラーハンドリング**: LSP エラーコードの適切な処理

## トラブルシューティング

### よくある問題

1. **初期化エラー**: サーバーが適切に初期化されていない
2. **パス解決エラー**: 相対パスと絶対パスの処理
3. **エンコーディング問題**: URI のエンコーディング不一致
4. **タイムアウト**: 長時間実行されるリクエストの処理

### デバッグ方法

1. LSP 通信ログの確認
2. サーバーの初期化状態の確認
3. 機能サポートの確認
4. エラーコードの詳細確認

## 基本的な JSON 構造

### 位置（Position）

テキストドキュメント内の位置を表現する、0ベースの行と文字オフセット：

```typescript
interface Position {
    line: number;     // 行番号（0ベース）
    character: number; // 文字オフセット（0ベース）
}
```

### 範囲（Range）

テキストドキュメント内の範囲を表現する、開始位置と終了位置：

```typescript
interface Range {
    start: Position;  // 開始位置
    end: Position;    // 終了位置
}
```

### 位置エンコーディング

LSP 3.17 以降、文字オフセットの解釈方法を指定できます：

```typescript
export namespace PositionEncodingKind {
    export const UTF8 = 'utf-8';    // UTF-8 コードユニット
    export const UTF16 = 'utf-16';  // UTF-16 コードユニット（デフォルト）
    export const UTF32 = 'utf-32';  // UTF-32 コードユニット
}
```

### テキストドキュメント

```typescript
interface TextDocumentItem {
    uri: string;        // ドキュメントの URI
    languageId: string; // 言語識別子
    version: number;    // バージョン番号
    text: string;       // ドキュメントの内容
}
```

### 言語識別子

LSP では以下の言語識別子が推奨されています：

| 言語 | 識別子 |
|------|--------|
| TypeScript | `typescript` |
| JavaScript | `javascript` |
| Python | `python` |
| Go | `go` |
| Rust | `rust` |
| Java | `java` |
| C# | `csharp` |
| C++ | `cpp` |
| C | `c` |
| F# | `fsharp` |
| PHP | `php` |
| Ruby | `ruby` |
| Swift | `swift` |
| Kotlin | `kotlin` |
| Scala | `scala` |
| HTML | `html` |
| CSS | `css` |
| JSON | `json` |
| XML | `xml` |
| YAML | `yaml` |
| Markdown | `markdown` |
| Shell Script | `shellscript` |
| SQL | `sql` |
| Dockerfile | `dockerfile` |

### ドキュメントフィルター

特定の条件に一致するドキュメントを選択するためのフィルター：

```typescript
interface DocumentFilter {
    language?: string;  // 言語識別子
    scheme?: string;    // URI スキーム
    pattern?: string;   // ファイルパターン
}
```

例：
```typescript
// TypeScript ファイル
{ language: 'typescript', scheme: 'file' }

// package.json ファイル
{ language: 'json', pattern: '**/package.json' }
```

## 初期化プロセス

LSP サーバーとクライアントの通信は、必ず初期化プロセスから始まります：

1. **Initialize Request**: クライアントがサーバーに機能を問い合わせ
2. **Initialize Response**: サーバーが対応機能を返答
3. **Initialized Notification**: 初期化完了を通知

### 初期化リクエストの例

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "processId": 1234,
        "rootPath": "/path/to/project",
        "workspaceFolders": [
            {
                "uri": "file:///path/to/project",
                "name": "MyProject"
            }
        ],
        "capabilities": {
            "textDocument": {
                "completion": {
                    "completionItem": {
                        "snippetSupport": true
                    }
                }
            }
        }
    }
}
```

## 動的機能登録

LSP では、初期化後に動的に機能を登録/解除できます：

```typescript
// 機能の登録
client/registerCapability

// 機能の解除  
client/unregisterCapability
```

## ワークスペース機能

### ワークスペースフォルダー

複数のプロジェクトルートを管理：

```typescript
interface WorkspaceFolder {
    uri: string;  // フォルダーの URI
    name: string; // フォルダー名
}
```

### 設定管理

```typescript
// 設定の取得
workspace/configuration

// 設定変更の通知
workspace/didChangeConfiguration
```

## 高度な機能

### インライン値（Inline Values）

デバッグ時に変数の値をインライン表示：

```typescript
interface InlineValue {
    range: Range;
    text: string;
}
```

### インレイヒント（Inlay Hints）

型情報やパラメータ名などを表示：

```typescript
interface InlayHint {
    position: Position;
    label: string;
    kind?: InlayHintKind;
}
```

### 型階層（Type Hierarchy）

型の継承関係を表示：

```typescript
interface TypeHierarchyItem {
    name: string;
    kind: SymbolKind;
    uri: string;
    range: Range;
}
```

## パフォーマンス最適化

### 部分結果（Partial Results）

大きな結果セットを段階的に送信：

```typescript
interface PartialResultParams {
    partialResultToken?: ProgressToken;
}
```

### 作業完了進捗（Work Done Progress）

長時間実行される操作の進捗表示：

```typescript
interface WorkDoneProgressParams {
    workDoneToken?: ProgressToken;
}
```

## セキュリティ考慮事項

1. **URI 検証**: 受信した URI の妥当性を確認
2. **パス正規化**: 相対パスと絶対パスの適切な処理
3. **入力検証**: パラメータの型と範囲の検証
4. **リソース制限**: メモリ使用量とCPU使用率の制限

## リソース

- [Language Server Protocol 公式サイト](https://microsoft.github.io/language-server-protocol/)
- [VS Code Language Server Extension ガイド](https://code.visualstudio.com/api/language-extensions/language-server-extension-guide)
- [LSP 実装例](https://github.com/Microsoft/vscode-languageserver-node)
- [LSP 仕様書（英語）](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [JSON-RPC 2.0 仕様](https://www.jsonrpc.org/specification)