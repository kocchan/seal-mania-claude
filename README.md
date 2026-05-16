# seal-mania-claude

ボンボンドロップシールの情報を自動収集・記事生成・WordPress投稿するツール。

## 機能概要

### 1. 目撃情報収集・記事生成

SNS（X/Threads）から目撃情報を収集し、記事を生成する。

### 2. 抽選販売情報パイプライン

抽選販売情報の収集からWordPress投稿までを自動化。

```
/lotteryinfo-pipeline
```

**パイプライン構成:**
```
collect → generate-article → images → post → git push
```

| Phase | スキル | 役割 |
|-------|--------|------|
| 1 | `/lotteryinfo-collect` | LivePocket/店舗Xから情報収集 → raw/ |
| 2 | `/lotteryinfo-generate-article` | raw/ → drafts/に記事生成 |
| 3 | `/lotteryinfo-images` | Gemini AIで画像生成 → images/ |
| 4 | `/lotteryinfo-post` | WordPress REST APIで投稿 |

詳細: [docs/lotteryinfo-architecture.md](docs/lotteryinfo-architecture.md)

### 3. 新作情報 RSS スクレイプ

Google アラート等の RSS フィードから新作情報を日次取得し、記事 URL をスクレイピングして本文・OGP 画像 URL を保存する。GitHub Actions が毎日 9:00 JST に自動実行。

```bash
npm run rss:scrape
```

詳細: [docs/rss/scrape.md](docs/rss/scrape.md)

### 4. RSS → 記事生成パイプライン（Claude Code Routines 用）

RSS で集めた記事を、抽選情報・新作情報の二系統に振り分けて記事を生成する。Claude Code Routines から定期実行する想定。

| エージェント | 役割 | 出力先 |
|-------------|------|--------|
| `/rss-lottery-pipeline` | RSS → 抽選記事生成 → 画像生成 → WordPress投稿 | `output/lottery-info/drafts/` |
| `/rss-newproduct-pipeline` | RSS → 新作記事生成 → git push | `output/newproduct/drafts/` |

個別スキル:

| スキル | 役割 |
|--------|------|
| `/rss-lottery-article` | RSSから抽選情報を選別し記事を生成 |
| `/rss-newproduct-article` | RSSから新作情報を選別し記事を生成 |

## セットアップ

```bash
npm install
npx playwright install chromium
```

### 環境変数

```env
# Gemini API（画像生成）
GEMINI_API_KEY=your-gemini-api-key

# WordPress
WP_API_URL=https://your-site.com/wp-json/wp/v2
WP_USER=your-username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# アフィリエイト
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id
YAHOO_CLIENT_ID=your-yahoo-client-id

# Apify（Threads収集）
APIFY_TOKEN=your-apify-token

# RSS スクレイプ（カンマ区切りで複数指定可、Google アラート等）
RSS_FEED_URLS=https://www.google.com/alerts/feeds/XXXX/YYYY
```

## テーマ設定

`config/sightings.json` で目撃情報のテーマを設定:

```json
{
  "theme": {
    "name": "ボンボンドロップシール",
    "keywords": ["ボンボンドロップシール", "ボンドロ"]
  }
}
```

`config/lotteryinfo.json` で抽選販売のカテゴリ・タグを設定:

```json
{
  "wordpress": {
    "categoryMap": {
      "抽選・予約情報": 918,
      "サンリオ": 930,
      "ちいかわ": 933
    }
  }
}
```

## フォルダ構成

```
seal-mania-claude/
├── .claude/
│   ├── agent/
│   │   ├── lotteryinfo-pipeline/         # 抽選販売 統合パイプライン
│   │   ├── rss-lottery-pipeline/         # RSS→抽選記事 統合パイプライン
│   │   └── rss-newproduct-pipeline/      # RSS→新作記事 統合パイプライン
│   └── skills/
│       ├── lotteryinfo-collect/          # 抽選: 情報収集
│       ├── lotteryinfo-generate-article/ # 抽選: 記事生成（LivePocket由来）
│       ├── lotteryinfo-images/           # 抽選: 画像生成
│       ├── lotteryinfo-post/             # 抽選: WordPress投稿
│       ├── rss-lottery-article/          # RSS→抽選記事生成
│       ├── rss-newproduct-article/       # RSS→新作記事生成
│       ├── sightings-collect-x/          # X目撃情報収集
│       ├── sightings-collect-threads/    # Threads目撃情報収集
│       └── sightings-generate-articles/  # 目撃情報記事生成
│
├── scripts/lotteryinfo/
│   ├── generate-images.js                # 画像生成スクリプト
│   └── post-wordpress.js                 # WordPress投稿スクリプト
│
├── scripts/rss/
│   └── scrape.js                         # RSS取得＋本文スクレイピング
│
├── config/
│   ├── sightings.json                    # 目撃情報テーマ設定
│   ├── lotteryinfo.json                  # 抽選販売カテゴリ設定
│   └── rss.json                          # RSS設定
│
├── output/
│   ├── lottery-info/
│   │   ├── raw/{date}/                   # 収集したrawデータ
│   │   ├── drafts/{date}/                # 生成した記事
│   │   └── images/{date}/                # 生成した画像
│   ├── newproduct/
│   │   └── drafts/{date}/                # RSS由来の新作記事ドラフト
│   ├── rss/{date}/                       # RSSから取得した記事
│   └── blog/
│       └── raw/                          # 目撃情報rawデータ
│
└── docs/
    ├── lotteryinfo-architecture.md       # アーキテクチャドキュメント
    └── rss/scrape.md                     # RSS取得ドキュメント
```

## スクリプト

```bash
# 抽選販売
npm run lotteryinfo:images    # 画像生成
npm run lotteryinfo:post      # WordPress投稿

# 新作情報
npm run newproduct:post       # WordPress投稿（output/newproduct/drafts/）

# 新作情報 RSS
npm run rss:scrape            # RSS取得＋スクレイピング

# 目撃情報
npm run scrape:yahoo          # Yahoo経由でX収集
npm run scrape:threads        # Threads収集
npm run generate:articles     # 記事生成
npm run post:wordpress        # WordPress投稿
```

## 運用

### 自動実行（cron / Claude Code Routines）

```cron
# 抽選販売パイプライン (LivePocket由来): 毎日 7:00 / 13:00 / 19:00
0 7,13,19 * * * cd /path/to/seal-mania-claude && claude -p "/lotteryinfo-pipeline"

# 目撃情報収集: 毎日 6:00 / 12:00 / 18:00
0 6,12,18 * * * cd /path/to/seal-mania-claude && npm run scrape:all
```

Claude Code Routines（RSS 系）:

| Routine | スケジュール | コマンド |
|---------|-----------|----------|
| RSS スクレイプ | 9:00 JST | GitHub Actions (`.github/workflows/rss-scrape.yml`) |
| RSS→抽選記事 | 10:00 JST 推奨 | `claude -p "/rss-lottery-pipeline"` |
| RSS→新作記事 | 11:00 JST 推奨 | `claude -p "/rss-newproduct-pipeline"` |
