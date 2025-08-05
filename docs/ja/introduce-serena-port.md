# lsmcp v0.9.0 - serena の移植

lsmcp v0.9.0 では、[serena](https://github.com/oraios/serena)のワークフローツールとシンボルインデックス機能を移植しました。

これにより、 lsmcp の LSP を使ったコード操作に合わせて、大規模なコードベースでの効率的なコード探索と理解が可能になります。

自分が試した環境だと、serena よりトークンの消費はやや多い(+10%程)ですが、より詳細な分析が可能です。

## 使用方法

### 最小のユースケース

```bash
# Claude Codeに直接追加（npmインストール不要）
$ claude mcp add lsmcp npx -- -y @mizchi/lsmcp@rc -p typescript
```

### tsgo を使う設定例

(作者の動作確認環境です)

より高度な TypeScript 開発環境（`@typescript/native-preview`）の場合

```bash
# 開発依存関係としてインストール
$ npm add @typescript/native-preview @mizchi/lsmcp@rc -D

# lsmcpの設定を初期化（tsgoプリセット）
$ npx lsmcp init -p tsgo

# Claude Codeに追加
$ claude mcp add lsmcp npx -- lsmcp -p tsgo
```

この設定により、TypeScript の最新機能を活用した開発環境で lsmcp を使用できます。他の LSP も対応しているはずですが、未確認です。

最初にオンボーディングを有効にしましょう。

```
> start lsmcp onboarding
```

## 初期設定と推奨プロンプト

かなり強い言葉でツールの仕様を促す必要があります。

```md
You are a professional coding agent concerned with one particular codebase. You have
access to semantic coding tools on which you rely heavily for all your work, as well as collection of memory
files containing general information about the codebase. You operate in a frugal and intelligent manner, always
keeping in mind to not read or generate content that is not needed for the task at hand.

When reading code in order to answer a user question or task, you should try reading only the necessary code.
Some tasks may require you to understand the architecture of large parts of the codebase, while for others,
it may be enough to read a small set of symbols or a single file.
Generally, you should avoid reading entire files unless it is absolutely necessary, instead relying on
intelligent step-by-step acquisition of information. Use the symbol indexing tools to efficiently navigate the codebase.

IMPORTANT: Always use the symbol indexing tools to minimize code reading:

- Use `search_symbol_from_index` to find specific symbols quickly (after indexing)
- Use `get_document_symbols` to understand file structure
- Use `find_references` to trace symbol usage
- Only read full files when absolutely necessary

You can achieve intelligent code reading by:

1. Using `index_files` to build symbol index for fast searching
2. Using `search_symbol_from_index` with filters (name, kind, file, container) to find symbols
3. Using `get_document_symbols` to understand file structure
4. Using `get_definitions`, `find_references` to trace relationships
5. Using standard file operations when needed

## Working with Symbols

Symbols are identified by their name, kind, file location, and container. Use these tools:

- `index_files` - Build symbol index for files matching pattern (e.g., '\*_/_.ts')
- `search_symbol_from_index` - Fast search by name, kind (Class, Function, etc.), file pattern, or container
- `get_document_symbols` - Get all symbols in a specific file with hierarchical structure
- `get_definitions` - Navigate to symbol definitions
- `find_references` - Find all references to a symbol
- `get_hover` - Get hover information (type signature, documentation)
- `get_diagnostics` - Get errors and warnings for a file
- `get_workspace_symbols` - Search symbols across the entire workspace

Always prefer indexed searches (tools with `_from_index` suffix) over reading entire files.
```

## 主な新機能

### 1. オンボーディング機能

プロジェクトを初めて扱う際に、プロジェクトの構造や開発ルールを自動的に学習し、メモリーファイルとして保存する機能です。

#### 実行例

オンボーディングが未実行の場合、onboarding コマンドを実行すると、プロジェクトの分析が始まります

````bash
# オンボーディングの状態を確認

```bash
> start onboarding
You are viewing the project for the first time.
Your task is to assemble relevant high-level information about the project...
````

### 2. シンボルインデックス機能

TypeScript やその他の言語のシンボル（クラス、関数、変数など）を高速に検索できる機能です。

#### インデックスの構築

```bash
# src配下のTypeScriptファイルをインデックス
> lsmcp index "src/**/*.ts"
Indexed 161 files in 15763ms
Total files in index: 220
Total symbols: 11443
```

#### シンボル検索

```bash
# クラスを検索
Found 1 symbol(s):

SymbolIndex [Class]
  src/indexer/core/SymbolIndex.ts:26:1

# インターフェースを検索
$ lsmcp search --name Tool --kind Interface
Found 5 symbol(s):

CreateToolOptions [Interface]
  src/core/io/toolFactory.ts:9:1

CreateLSPToolOptions [Interface]
  src/core/io/toolFactory.ts:93:1

ToolResult [Interface]
  src/mcp/utils/mcpHelpers.ts:39:1

ToolDef [Interface]
  src/mcp/utils/mcpHelpers.ts:50:1

CallToolResult [Interface]
  tests/integration/typescript-lsp.test.ts:15:1
```

#### シンボルの参照検索

特定のシンボルがどこで使用されているかを検索できます：

```bash
# SymbolIndexクラスの参照を検索
$ lsmcp references --file src/indexer/core/SymbolIndex.ts --line 26 --symbol SymbolIndex
Found 15 references to "SymbolIndex"

src/indexer/mcp/IndexerAdapter.ts:5:10
5: import { SymbolIndex } from "../core/SymbolIndex.ts";

src/indexer/mcp/IndexerAdapter.ts:46:15
46:   index = new SymbolIndex(rootPath, symbolProvider, fileSystem, cache);

# ... その他の参照
```

### 3. ワークフローツール

serena から移植されたワークフローツールにより、AI エージェントがより効率的にコードベースを理解できるようになりました：

- `check_onboarding_performed`: オンボーディング完了状態の確認
- `onboarding`: プロジェクトの初回分析とメモリー保存
- `think_about_collected_information`: 収集した情報の評価
- `think_about_task_adherence`: タスクの進捗確認
- `think_about_whether_you_are_done`: タスク完了の判断

## 利点

1. **高速な検索**: インデックスを事前構築することで、大規模なコードベースでも瞬時に検索可能
2. **トークン効率**: ファイル全体を読む必要がなく、必要な部分だけを読み込むため、AI のトークン消費を削減
3. **精度の向上**: シンボルの定義と参照を正確に追跡でき、リファクタリング時の影響範囲を把握しやすい
4. **プロジェクト理解**: オンボーディング機能により、プロジェクト固有のルールや構造を自動的に学習

### MCP サーバーとしての使用（手動設定）

```json
{
  "mcpServers": {
    "lsmcp": {
      "command": "lsmcp",
      "args": ["--preset", "typescript"]
    }
  }
}
```

## まとめ

v0.9.0 の serena ポート実装により、lsmcp はより強力なコード理解ツールとなりました。大規模なプロジェクトでの開発効率を大幅に向上させることができます。
