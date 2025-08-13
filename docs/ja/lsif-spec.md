# LSIF 概要 (短縮版)

本書は Microsoft の公式 Overview を要約した日本語の短縮版です。後続の詳細版で図や仕様項目の網羅を追加予定です。

## これは何か

Language Server Index Format (LSIF) は、リポジトリをローカルにクローンせずとも Web UI やツール上で Hover、Go to Definition、Find All References などのリッチなコードナビゲーションを提供するための交換フォーマットです。言語サーバーや他のツールがワークスペースに関する知識を事前に出力し、後からそのデータを使って LSP 相当の問いに答えます。

## なぜ必要か

LSP の言語サーバーは全ファイルをローカルに保持し解析する前提ですが、PR レビューやブラウザ上の閲覧ではそれが重い/不可能な場合があります。LSIF は事前計算済みの結果を永続化し、実行時には言語サーバーを起動せずに結果を提供します。

## 仕組みの要点

- LSP のデータ型を再利用し、LSP リクエストの結果をモデル化して永続化する
- 位置(Position)ではなく範囲(Range)を基本単位にして重複を圧縮する
- グラフ表現で記述する: 頂点(vertex)=document, range, 各種 result; 辺(edge)=contains, textDocument/hover など
- データはストリーミング出力可能で、大規模コードでもメモリ効率よく生成できる
- 言語の意味論や「何が定義か」などのシンボル意味付けは対象外（LSP と同様に非目標）

## 代表的な例（文章による要約）

- Hover: ある識別子の範囲に対して hoverResult 頂点を結び付け、textDocument/hover 辺で関連付ける
- Folding Range: document 頂点に foldingRangeResult 頂点を結び付け、textDocument/foldingRange 辺で関連付ける

## サポートされる主なリクエスト種別（Overview 時点）

Document Symbols、Document Links、Go to Declaration、Go to Definition、Go to Type Definition、Find All References、Go to Implementation、Hover、Folding Range。Moniker によるシンボル関連付けも仕様に含まれ、LSP の textDocument/moniker と整合するように計算することが推奨されます。

## LSP との関係

- LSIF は LSP を置き換えるものではなく、LSP の型と概念を流用して「事前計算済みの結果を配布する」ためのフォーマット
- 既存の LSP 対応クライアント/サービスに統合しやすい

## 主な適用シナリオ

- PR レビューやブラウザでのコード閲覧時に、定義ジャンプや参照検索を提供
- CI で LSIF を生成・配布して、エディタや Web サービスで高速に応答

## 参考リンク

- Overview: https://microsoft.github.io/language-server-protocol/overviews/lsif/overview/
- 仕様 0.4.0: https://microsoft.github.io/language-server-protocol/specifications/lsif/0.4.0/specification
- LSIF Index for TypeScript: https://github.com/Microsoft/lsif-node
- VS Code 拡張 (LSIF): https://github.com/Microsoft/vscode-lsif-extension
- フィードバック Issue: https://github.com/Microsoft/language-server-protocol/issues/623

## 関連ドキュメント

- LSP の Moniker 解説は [../lsp-spec.md](../lsp-spec.md) を参照

本文は概要のみを扱っています。詳細版ではグラフ要素の一覧、サンプル、Mermaid 図、最適化、制約事項などを追記します。
