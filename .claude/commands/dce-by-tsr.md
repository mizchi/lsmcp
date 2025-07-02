# Dead Code Elimination with tsr

このコマンドは[tsr](https://github.com/nadeesha/ts-remove-unused)を使用して、TypeScript プロジェクトの未使用コードを検出します。

## 実行方法

```bash
npx tsr 'src/mcp/(lsmcp|typescript-mcp|generic-lsp-mcp)\.ts$'
```

## オプション

- `--write`: 検出された未使用コードを自動的に削除します（注意：テストファイルも削除される可能性があります）
- `--recursive`: プロジェクトがクリーンになるまで再帰的にチェックします
- `--project <file>`: カスタム tsconfig.json のパスを指定します
- `--include-d-ts`: .d.ts ファイルの未使用コードもチェックします

## 注意事項

- tsr はエントリーポイントから到達可能なコードのみを保持します
- テストファイルは通常のエントリーポイントから参照されないため、未使用として検出される可能性があります
- `--write`オプションを使用する前に、必ず結果を確認してください

## このプロジェクトでの使用例

- `src/mcp/lsmcp.ts` - メインの LSP MCP CLI

実行すると、これらのエントリーポイントから到達できないエクスポートやファイルが表示されます。
