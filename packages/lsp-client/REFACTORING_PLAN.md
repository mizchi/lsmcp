# LSP Client Refactoring Plan

## 現在の問題点

1. **ファイルサイズ**
   - lspClient.ts: 847行 → 分割が必要
   - debugLogger.ts: 508行 → 機能別に分割
   - lspValidator.ts: 407行 → 責務の分離
   - lspTypes.ts: 401行 → カテゴリ別に分類

2. **責務の混在**
   - ルートディレクトリに17ファイルが混在
   - client/とtools/の責務が不明確
   - プロトコル処理、クライアント管理、ツールが混在

## 新しいディレクトリ構造

```
packages/lsp-client/src/
├── core/                    # コアLSPクライアント機能
│   ├── client.ts           # LSPClient実装 (メイン)
│   ├── connection.ts       # 接続管理
│   ├── lifecycle.ts        # 初期化/シャットダウン
│   ├── state.ts           # クライアント状態管理
│   └── factory.ts         # クライアント生成
│
├── protocol/               # LSPプロトコル層
│   ├── types/             # プロトコル型定義
│   │   ├── base.ts       # 基本型
│   │   ├── requests.ts   # リクエスト型
│   │   ├── responses.ts  # レスポンス型
│   │   └── notifications.ts # 通知型
│   ├── parser.ts          # メッセージパーサー
│   ├── formatter.ts       # メッセージフォーマッター
│   └── transport.ts       # メッセージ送受信
│
├── features/              # LSP機能実装
│   ├── definitions.ts    # 定義ジャンプ
│   ├── references.ts     # 参照検索
│   ├── hover.ts         # ホバー情報
│   ├── completion.ts    # コード補完
│   ├── diagnostics.ts   # 診断情報
│   ├── symbols.ts       # シンボル関連
│   ├── formatting.ts    # フォーマット
│   ├── rename.ts        # リネーム
│   ├── codeActions.ts   # コードアクション
│   └── signatureHelp.ts # シグネチャヘルプ
│
├── managers/             # 管理コンポーネント
│   ├── document.ts      # ドキュメント管理
│   ├── diagnostics.ts   # 診断管理
│   ├── request.ts       # リクエスト管理
│   ├── workspace.ts     # ワークスペース編集
│   └── pool.ts         # プロセスプール
│
├── adapters/            # 言語アダプター
│   ├── base.ts         # ベースアダプター
│   ├── typescript.ts   # TypeScript固有
│   ├── registry.ts     # アダプター登録
│   └── validation.ts   # アダプター検証
│
├── debug/               # デバッグ・ログ機能
│   ├── logger.ts       # ログ基本機能
│   ├── session.ts      # セッション管理
│   ├── export.ts       # エクスポート機能
│   └── levels.ts       # ログレベル定義
│
├── testing/             # テスト支援
│   ├── tester.ts       # LSPテスター
│   ├── validator.ts    # 機能検証
│   └── helpers.ts      # テストヘルパー
│
├── utils/              # ユーティリティ
│   ├── errors.ts       # エラー処理
│   ├── language.ts     # 言語検出
│   ├── filesystem.ts   # ファイルシステム
│   └── helpers.ts      # その他ヘルパー
│
└── index.ts            # パブリックAPI
```

## ファイル統廃合計画

### 1. lspClient.ts (847行) → 分割

**core/client.ts** (約200行)
- LSPClientインターフェース
- 主要なパブリックメソッド

**core/connection.ts** (約150行)
- processBuffer
- handleMessage
- sendMessage/sendRequest

**core/lifecycle.ts** (約150行)
- initialize
- start/stop
- waitForServerReady

**core/state.ts** (約100行)
- LSPClientState
- 状態管理ロジック

**features/** (各50-100行)
- 各LSP機能を個別ファイルに

### 2. lspTypes.ts (401行) → 分割

**protocol/types/base.ts** (約100行)
- LSPMessage, LSPRequest, LSPResponse
- 基本的な型ガード

**protocol/types/requests.ts** (約100行)
- 各種リクエストパラメータ型

**protocol/types/responses.ts** (約100行)
- 各種レスポンス型

**protocol/types/notifications.ts** (約100行)
- 通知関連の型

### 3. debugLogger.ts (508行) → 分割

**debug/logger.ts** (約150行)
- 基本ログ機能

**debug/session.ts** (約150行)
- セッション管理

**debug/export.ts** (約100行)
- エクスポート機能

**debug/levels.ts** (約50行)
- ログレベル定義と制御

### 4. 統合するファイル

**managers/document.ts**
- documentManager.ts (122行)
- lsp-utils/documentManager.ts の関連部分

**managers/diagnostics.ts**
- diagnosticsManager.ts (150行)
- diagnosticUtils.ts (146行)

**managers/request.ts**
- requestManager.ts (114行)

**protocol/transport.ts**
- protocol.ts (107行)
- 関連するメッセージ処理

## 移行の優先順位

### Phase 1: 基盤整備
1. ディレクトリ構造の作成
2. protocol/types の分離
3. core/ の基本構造確立

### Phase 2: 機能分離
4. features/ への機能移行
5. managers/ の整理
6. debug/ の再構成

### Phase 3: 最適化
7. adapters/ の整理
8. utils/ の統合
9. テストの更新

## 依存関係の管理

- 循環参照を避けるため、依存の方向を明確化
- core → protocol (依存OK)
- features → core, protocol (依存OK)
- managers → protocol (依存OK)
- adapters → core, features (依存OK)

## インターフェースの保持

- 現在のパブリックAPIは維持
- index.ts で既存のエクスポートを保持
- 段階的な移行を可能に

## 期待される効果

1. **可読性向上**: 各ファイル500行以下
2. **責務明確化**: ディレクトリ構造で役割が明確
3. **保守性向上**: 機能追加・変更が容易
4. **テスト容易性**: 単体テストが書きやすい
5. **再利用性**: 他パッケージからの参照が明確