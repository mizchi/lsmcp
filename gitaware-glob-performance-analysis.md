# gitaware-glob パフォーマンス分析と改善提案

## 🔍 パフォーマンス測定結果

ベンチマーク結果により、`gitaware-glob`は単純なファイルシステムウォーカーと比較して**約3800倍遅い**ことが判明しました：

- **gitaware-glob**: 13,711ms (src/tools/finder で "function" を検索)
- **カスタム実装**: 3.66ms (同じ条件)
- **速度差**: 3,869倍

## 🐌 パフォーマンスボトルネックの原因

### 1. **過度な非同期処理のオーバーヘッド**

`walk.ts`の問題点：
```typescript
// 現在の実装 (walk.ts:159-165)
async function* walkDirectory(...) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const updatedScopedPatterns = await loadLocalGitignorePatterns(...);
  
  for (const entry of entries) {
    yield* processEntry(...);  // 各エントリーに対して非同期ジェネレータ
  }
}
```

**問題**: 各ディレクトリ、各ファイルに対して非同期ジェネレータのオーバーヘッドが発生

### 2. **gitignoreパターンの重複処理**

`glob.ts`の問題点：
```typescript
// 現在の実装 (glob.ts:49-73)
async function findRelevantGitignoreFiles(...) {
  while (true) {
    const gitignorePath = await findGitignoreInDir(currentPath, fs);
    // 親ディレクトリまで遡って.gitignoreを探す
  }
}
```

**問題**: 
- すべてのglob呼び出しで親ディレクトリまで遡って.gitignoreを探す
- パターンのキャッシュがない
- 同じディレクトリを何度も処理

### 3. **パターンマッチングの非効率性**

`walk.ts`の問題点：
```typescript
// 現在の実装 (walk.ts:57-77)
function shouldExclude(path: string, scopedPatterns: ScopedPattern[], baseDir: string): boolean {
  const applicablePatterns: string[] = [];
  
  for (const { pattern, scope } of scopedPatterns) {
    // すべてのパターンに対してチェック
  }
  
  return shouldExcludeByPatterns(path, applicablePatterns);
}
```

**問題**: 各ファイルに対してすべてのパターンを毎回評価

## 🚀 改善提案

### 1. **同期的な読み取りとバッチ処理**

```typescript
// 改善案: 同期的な読み取りを使用
function* walkDirectorySync(dir: string, patterns: CompiledPatterns) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  // バッチでフィルタリング
  const validEntries = entries.filter(entry => 
    !shouldExcludeBatch(entry, patterns)
  );
  
  for (const entry of validEntries) {
    if (entry.isDirectory()) {
      yield* walkDirectorySync(join(dir, entry.name), patterns);
    } else {
      yield join(dir, entry.name);
    }
  }
}
```

### 2. **gitignoreパターンのキャッシュ**

```typescript
// 改善案: グローバルキャッシュを使用
class GitignoreCache {
  private cache = new Map<string, ParsedPatterns>();
  
  getPatterns(dir: string): ParsedPatterns {
    if (this.cache.has(dir)) {
      return this.cache.get(dir)!;
    }
    
    const patterns = this.loadPatternsOnce(dir);
    this.cache.set(dir, patterns);
    return patterns;
  }
}
```

### 3. **早期終了と最適化されたパターンマッチング**

```typescript
// 改善案: コンパイル済みパターンと早期終了
class OptimizedMatcher {
  private compiledPatterns: RegExp[];
  private simpleExcludes: Set<string>;  // 単純な文字列マッチ用
  
  shouldExclude(path: string): boolean {
    // 単純なマッチを先にチェック（高速）
    if (this.simpleExcludes.has(path)) return true;
    
    // 正規表現は必要な場合のみ
    for (const pattern of this.compiledPatterns) {
      if (pattern.test(path)) return true;
    }
    
    return false;
  }
}
```

### 4. **ストリーミング処理の改善**

```typescript
// 改善案: イテレータの直接使用
async function* fastGlob(pattern: string, options: Options) {
  const matcher = new OptimizedMatcher(options);
  
  // ディレクトリを並列で処理
  const queue = [options.cwd];
  const workers = [];
  
  while (queue.length > 0 || workers.length > 0) {
    while (queue.length > 0 && workers.length < MAX_WORKERS) {
      const dir = queue.shift()!;
      workers.push(processDirectory(dir, matcher));
    }
    
    const results = await Promise.race(workers);
    yield* results.files;
    queue.push(...results.subdirs);
  }
}
```

## 📊 期待される改善効果

上記の改善を実装することで：

1. **同期的読み取り**: 非同期オーバーヘッドを削減 → **10-20倍高速化**
2. **キャッシュ**: 重複処理を削減 → **5-10倍高速化**
3. **最適化されたマッチング**: パターン評価を高速化 → **2-3倍高速化**
4. **並列処理**: I/O待機時間を削減 → **2-5倍高速化**

総合的に**100-1000倍の高速化**が期待できます。

## 🔧 実装優先順位

1. **最優先**: gitignoreパターンのキャッシュ実装
2. **高優先**: 同期的な読み取りの導入（小さなファイル用）
3. **中優先**: パターンマッチングの最適化
4. **低優先**: 並列処理の実装

## 💡 追加の最適化案

- **Lazy evaluation**: 必要になるまでgitignoreを読まない
- **メモ化**: 同じディレクトリの結果をキャッシュ
- **ネイティブバインディング**: 重要な部分をRustで実装（長期的）

これらの改善により、`gitaware-glob`を現在の3800倍遅い状態から、実用的な速度（10倍以内の差）まで改善できると考えられます。