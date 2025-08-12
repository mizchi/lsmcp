# LSP Client File Organization Plan

## 現在のファイル構造と責務

### src/*.ts のファイル分析

| ファイル名 | 主な責務 | 提案する移動先 |
|----------|---------|--------------|
| **lspClient.ts** | LSPクライアントのメイン実装 | → `core/client.ts` |
| **lspTypes.ts** | LSP型定義 | → `protocol/types.ts` |
| **lspValidator.ts** | LSP機能の検証 | → `validation/validator.ts` |
| **lspTester.ts** | LSPテストスイート | → `testing/tester.ts` |
| **lspProcessPool.ts** | プロセスプール管理 | → `process/pool.ts` |
| **lspAdapterUtils.ts** | アダプター関連ユーティリティ | → `adapters/utils.ts` |
| **protocol.ts** | プロトコル処理 | → `protocol/parser.ts` |
| **requestManager.ts** | リクエスト管理 | → `protocol/request-manager.ts` |
| **documentManager.ts** | ドキュメント管理 | → `document/manager.ts` |
| **diagnosticsManager.ts** | 診断管理 | → `diagnostics/manager.ts` |
| **diagnosticUtils.ts** | 診断ユーティリティ | → `diagnostics/utils.ts` |
| **workspaceEditHandler.ts** | ワークスペース編集 | → `workspace/edit-handler.ts` |
| **globalClientManager.ts** | グローバルクライアント管理 | → `client/global-manager.ts` |
| **debugLogger.ts** | デバッグとログ | → `debug/logger.ts` |
| **testHelpers.ts** | テストヘルパー | → `testing/helpers.ts` |
| **withLSPOperation.test.ts** | テストファイル | → `testing/withLSPOperation.test.ts` |
| **index.ts** | パブリックAPI | そのまま |

## 新しいディレクトリ構造

```
packages/lsp-client/src/
├── core/              # コアLSPクライアント機能
│   └── client.ts      ← lspClient.ts
│
├── protocol/          # プロトコル層
│   ├── types.ts       ← lspTypes.ts
│   ├── parser.ts      ← protocol.ts
│   └── request-manager.ts ← requestManager.ts
│
├── client/            # クライアント管理
│   ├── global-manager.ts ← globalClientManager.ts
│   └── (既存のlspOperations.ts, toolFactory.ts等)
│
├── process/           # プロセス管理
│   └── pool.ts        ← lspProcessPool.ts
│
├── adapters/          # 言語アダプター
│   └── utils.ts       ← lspAdapterUtils.ts
│
├── validation/        # 検証機能
│   └── validator.ts   ← lspValidator.ts
│
├── testing/           # テスト関連
│   ├── tester.ts      ← lspTester.ts
│   ├── helpers.ts     ← testHelpers.ts
│   └── withLSPOperation.test.ts ← withLSPOperation.test.ts
│
├── document/          # ドキュメント管理
│   └── manager.ts     ← documentManager.ts
│
├── diagnostics/       # 診断機能
│   ├── manager.ts     ← diagnosticsManager.ts
│   └── utils.ts       ← diagnosticUtils.ts
│
├── workspace/         # ワークスペース管理
│   └── edit-handler.ts ← workspaceEditHandler.ts
│
├── debug/             # デバッグ機能
│   └── logger.ts      ← debugLogger.ts
│
├── commands/          # (既存のまま)
├── tools/             # (既存のまま)
├── interfaces/        # (既存のまま)
├── utils/             # (既存のまま)
├── typescript/        # (既存のまま)
├── lsp-utils/         # (既存のまま)
├── providers/         # (既存のまま)
├── container/         # (既存のまま)
├── constants/         # (既存のまま)
├── implementations/   # (既存のまま)
└── index.ts           # パブリックAPI

```

## 移行の利点

1. **責務の明確化**: 各ディレクトリが明確な役割を持つ
2. **命名の一貫性**: lsp* プレフィックスが不要に
3. **探しやすさ**: ファイルの場所が予測しやすい
4. **スケーラビリティ**: 新機能追加時のディレクトリが明確

## 移行手順

1. 新しいディレクトリを作成
2. ファイルを移動
3. インポートパスを更新
4. index.tsのエクスポートを更新
5. ビルドとテストで確認

## 注意事項

- 後方互換性のため、index.tsからの再エクスポートは維持
- 移動時にファイル名からlspプレフィックスを削除（例: lspClient.ts → client.ts）
- 既存のディレクトリ（commands, tools等）はそのまま維持