# Dead Code Elimination with tsr

このコマンドは[tsr](https://github.com/nadeesha/ts-remove-unused)を使用して、TypeScriptプロジェクトの未使用コードを検出します。

## 実行方法

```bash
npx tsr 'src/mcp/(lsmcp|typescript-mcp|generic-lsp-mcp)\.ts$'
```

## オプション

- `--write`: 検出された未使用コードを自動的に削除します（注意：テストファイルも削除される可能性があります）
- `--recursive`: プロジェクトがクリーンになるまで再帰的にチェックします
- `--project <file>`: カスタムtsconfig.jsonのパスを指定します
- `--include-d-ts`: .d.tsファイルの未使用コードもチェックします

## 注意事項

- tsrはエントリーポイントから到達可能なコードのみを保持します
- テストファイルは通常のエントリーポイントから参照されないため、未使用として検出される可能性があります
- `--write`オプションを使用する前に、必ず結果を確認してください

## このプロジェクトでの使用例

lsmcpプロジェクトには3つのエントリーポイントがあります：
- `src/mcp/lsmcp.ts` - メインのLSP MCP CLI
- `src/mcp/typescript-mcp.ts` - TypeScript専用MCPサーバー
- `src/mcp/generic-lsp-mcp.ts` - 汎用LSP MCPサーバー

実行すると、これらのエントリーポイントから到達できないエクスポートやファイルが表示されます。