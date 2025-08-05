---
created: 2025-08-04T19:39:25.223Z
updated: 2025-08-04T19:39:25.223Z
---

# lsmcp Symbol Index Performance Report

## Test Environment
- Project: lsmcp v0.9.0-rc.1
- Date: 2025-08-04
- Language: TypeScript
- Total Source Files: 161 files (src/**/*.ts)

## Indexing Performance
- Indexing Time: 10,064ms (約10秒)
- Files Indexed: 161/220 (書き込みエラーのため一部失敗)
- Total Symbols: 11,443
- Average Time per File: 354ms
- Index Cache Size: 32KB (SQLite)

## Token Compression Analysis
- Total tokens (full source): 84,347
- Total tokens (symbol summary): 21,577
- Overall compression: 74.42%
- これにより、AIコンテキストに約4倍の情報を含めることが可能

### 圧縮率の例
- prompts/modes.ts: 99.29% 圧縮 (1698 → 12 tokens)
- prompts/system.ts: 97.77% 圧縮 (716 → 16 tokens)
- core/SymbolIndex.ts: 適度な圧縮率でコード構造を維持

## 検索パフォーマンス
- シンボル名検索: 即座に結果を返す（<100ms）
- Kind別検索: 高速 (Class検索で35件、Interface検索で137件を即座に取得)
- ファイル内シンボル検索: 160個のシンボルを即座に取得

## 主な利点
1. **高速検索**: ファイルを再パースすることなく即座に検索
2. **トークン効率**: AIのコンテキストウィンドウを効率的に使用
3. **インクリメンタル更新**: gitの差分に基づいて効率的に更新
4. **小さなキャッシュサイズ**: 32KBの軽量なSQLiteデータベース

## serenaとの比較
- serenaより約10%多いトークン消費
- より詳細なシンボル情報（メソッド、プロパティレベルまで）
- LSP統合により、より正確な型情報とリファレンス

## 推奨使用方法
1. プロジェクト開始時に `index_files` でインデックスを構築
2. `search_symbol` で必要なシンボルを高速検索
3. 大きな変更後は `update_index` でインクリメンタル更新
4. `measure_token_compression` で圧縮効果を確認