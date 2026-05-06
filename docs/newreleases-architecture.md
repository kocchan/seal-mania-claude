# 抽選販売システム アーキテクチャ

ボンボンドロップシールの抽選販売情報を収集し、WordPress記事として自動投稿するシステム。

## システム概要

```
┌─────────────────────────────────────────────────────────────────────┐
│                        newreleases-pipeline                         │
├─────────────┬─────────────┬─────────────┬─────────────┬────────────┤
│   collect   │  generate   │   images    │    post     │  git push  │
│             │   article   │             │             │            │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴─────┬──────┘
       │             │             │             │            │
       ▼             ▼             ▼             ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   Web    │  │   raw/   │  │  drafts/ │  │  images/ │  │ WordPress│
│ Sources  │  │   .md    │  │   .md    │  │   .png   │  │   API    │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
```

## データフロー

```
[LivePocket]  [店舗X]  [エポック社]
      │          │          │
      └────┬─────┴─────┬────┘
           │           │
           ▼           ▼
    ┌─────────────────────────┐
    │  Phase 1: collect       │
    │  - WebSearch/WebFetch   │
    │  - 情報抽出             │
    │  - rawデータ保存        │
    └───────────┬─────────────┘
                │
                ▼
        raw/{date}/*.md
                │
                ▼
    ┌─────────────────────────┐
    │  Phase 2: generate      │
    │  - rawデータ読み込み    │
    │  - 記事テンプレート適用 │
    │  - SEO最適化            │
    └───────────┬─────────────┘
                │
                ▼
      drafts/{date}/*.md
                │
                ▼
    ┌─────────────────────────┐
    │  Phase 3: images        │
    │  - Gemini API呼び出し   │
    │  - 画像生成・保存       │
    │  - frontmatter更新      │
    └───────────┬─────────────┘
                │
                ▼
      images/{date}/*.png
      drafts/*.md (imageGenerated: true)
                │
                ▼
    ┌─────────────────────────┐
    │  Phase 4: post          │
    │  - WordPress API        │
    │  - 画像アップロード     │
    │  - 記事投稿             │
    │  - frontmatter更新      │
    └───────────┬─────────────┘
                │
                ▼
    WordPress公開記事
    drafts/*.md (posted: true)
```

## ディレクトリ構成

```
seal-mania-claude/
├── .claude/
│   ├── agent/
│   │   └── newreleases-pipeline/     # 統合パイプライン（エージェント）
│   │       └── SKILL.md
│   │
│   └── skills/
│       ├── newreleases-collect/          # Phase 1: 情報収集
│       │   └── SKILL.md
│       ├── newreleases-generate-article/ # Phase 2: 記事生成
│       │   └── SKILL.md
│       ├── newreleases-images/           # Phase 3: 画像生成
│       │   └── SKILL.md
│       └── newreleases-post/             # Phase 4: WordPress投稿
│           └── SKILL.md
│
├── scripts/newreleases/
│   ├── generate-images.js            # 画像生成スクリプト
│   └── post-wordpress.js             # WordPress投稿スクリプト
│
├── config/
│   └── newreleases.json              # カテゴリ・タグ設定
│
├── output/new-releases/
│   ├── raw/{date}/                   # Phase 1出力
│   │   └── {slug}.md
│   ├── drafts/{date}/                # Phase 2出力
│   │   └── {slug}.md
│   └── images/{date}/                # Phase 3出力
│       └── {slug}.png
│
└── docs/
    └── newreleases-architecture.md   # このファイル
```

## 各スキル詳細

### 1. newreleases-collect

**役割:** 抽選販売情報の収集

**情報源:**
| ソース | URL | 取得内容 |
|--------|-----|----------|
| LivePocket | livepocket.jp/e/{id} | イベント詳細、申込情報 |
| 店舗X | x.com/{store_account} | 告知ツイート、添付画像 |
| エポック社 | epoch.jp | 新商品情報 |

**出力フォーマット:**
```yaml
---
source: livepocket
eventId: "6jwt4"
eventUrl: "https://livepocket.jp/e/6jwt4"
fetchedAt: "2026-05-06T14:45:00+09:00"
deadline: "2026-05-06T23:59:00+09:00"
status: "受付中"
images:
  - url: "https://..."
    type: "thumbnail"
---
# イベント名
...
```

### 2. newreleases-generate-article

**役割:** rawデータからWordPress記事を生成

**記事構成:**
1. タイトル（32文字以内、締切日含む）
2. 導入文（200文字）
3. 抽選・イベント概要（表）
4. 商品一覧（表）
5. 応募方法・手順
6. 注意点（5項目）
7. FAQ（5問）
8. 申込CTA
9. 店舗情報
10. 通販リンク（Amazon/楽天/Yahoo!）
11. まとめ

**SEO対策:**
- タイトル: キーワード前方配置
- description: 120文字以内
- 見出し階層: H1→H2→H3

### 3. newreleases-images

**役割:** Gemini AIでアイキャッチ画像を生成

**使用モデル:** `gemini-3.1-flash-image-preview`

**プロンプト構成:**
- スタイル: ポップな手描きイラスト風
- アスペクト比: 16:9
- 必須要素: 商品、店舗名、締切日、キャラクター

**キャラクター設定:**
```json
{
  "ちいかわ": {
    "brand": "ちいかわ",
    "characters": ["ちいかわ", "ハチワレ", "うさぎ", "モモンガ"]
  },
  "サンリオ": {
    "brand": "Sanrio",
    "characters": ["ハローキティ", "マイメロディ", "シナモロール", "ポムポムプリン"]
  }
}
```

### 4. newreleases-post

**役割:** WordPress REST APIで記事投稿

**処理内容:**
1. Markdown → HTML変換
2. アイキャッチ画像アップロード
3. カテゴリ・タグ設定
4. アフィリエイトリンク挿入（冒頭3、中盤2、末尾3）
5. X埋め込みプレビュー挿入
6. 記事投稿

**カテゴリマッピング:**
```json
{
  "抽選・予約情報": 918,
  "オンライン通販": 919,
  "キャラクターシール": 928,
  "サンリオ": 930,
  "ちいかわ": 933
}
```

## 状態管理

各Phaseの完了状態はfrontmatterで管理:

```yaml
---
# Phase 2完了後
type: lottery
status: draft

# Phase 3完了後
imageGenerated: true

# Phase 4完了後
posted: true
wpPostId: 5539
wpPostUrl: "https://..."
postedAt: "2026-05-06T12:12:02.412Z"
---
```

## API・外部サービス

| サービス | 用途 | 環境変数 |
|----------|------|----------|
| Gemini API | 画像生成 | GEMINI_API_KEY |
| WordPress REST API | 記事投稿 | WP_API_URL, WP_USER, WP_APP_PASSWORD |
| Yahoo! Shopping API | 商品検索 | YAHOO_CLIENT_ID |

## エラーハンドリング

### リトライ戦略

```javascript
const retry = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // 指数バックオフ
    }
  }
};
```

### Phase間の依存

| Phase | 前提条件 | 失敗時 |
|-------|----------|--------|
| 1 | なし | 終了 |
| 2 | raw/*.md が存在 | スキップ |
| 3 | drafts/*.md が存在 | スキップ |
| 4 | imageGenerated: true | スキップ |

## パフォーマンス

| 処理 | 所要時間目安 |
|------|-------------|
| Phase 1 (collect) | 1-3分 |
| Phase 2 (generate) | 30秒-1分 |
| Phase 3 (images) | 1件あたり5-10秒 |
| Phase 4 (post) | 1件あたり3-5秒 |

## 運用

### 自動実行（cron）

```cron
# 毎日 7:00 / 13:00 / 19:00 に実行
0 7,13,19 * * * cd /path/to/seal-mania-claude && claude -p "/newreleases-pipeline"
```

### 手動実行

```bash
# 全パイプライン
claude "/newreleases-pipeline"

# 個別Phase
claude "/newreleases-collect"
claude "/newreleases-generate-article"
npm run newreleases:images
npm run newreleases:post
```

### モニタリング

- WordPress投稿数の日次確認
- Gemini API使用量の監視
- エラーログの定期確認

## 拡張ポイント

### 将来の改善案

1. **情報源追加**
   - メルカリ在庫監視
   - 公式ECサイト新着

2. **画像品質向上**
   - 複数バリエーション生成
   - A/Bテスト

3. **SEO強化**
   - 構造化データ追加
   - 内部リンク自動生成

4. **通知機能**
   - Slack/Discord通知
   - 投稿完了メール
