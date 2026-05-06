# seal-mania-claude

ボンボンドロップシールの情報を自動収集・記事生成・WordPress投稿するツール。

## 機能概要

### 1. 目撃情報収集・記事生成

SNS（X/Threads）から目撃情報を収集し、記事を生成する。

### 2. 抽選販売情報パイプライン

抽選販売情報の収集からWordPress投稿までを自動化。

```
/newreleases-pipeline
```

**パイプライン構成:**
```
collect → generate-article → images → post → git push
```

| Phase | スキル | 役割 |
|-------|--------|------|
| 1 | `/newreleases-collect` | LivePocket/店舗Xから情報収集 → raw/ |
| 2 | `/newreleases-generate-article` | raw/ → drafts/に記事生成 |
| 3 | `/newreleases-images` | Gemini AIで画像生成 → images/ |
| 4 | `/newreleases-post` | WordPress REST APIで投稿 |

詳細: [docs/newreleases-architecture.md](docs/newreleases-architecture.md)

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

`config/newreleases.json` で抽選販売のカテゴリ・タグを設定:

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
│   │   └── newreleases-pipeline/         # 統合パイプライン
│   │       └── SKILL.md
│   └── skills/
│       ├── newreleases-collect/          # Phase 1: 情報収集
│       ├── newreleases-generate-article/ # Phase 2: 記事生成
│       ├── newreleases-images/           # Phase 3: 画像生成
│       ├── newreleases-post/             # Phase 4: WordPress投稿
│       ├── sightings-collect-x/          # X目撃情報収集
│       ├── sightings-collect-threads/    # Threads目撃情報収集
│       └── sightings-generate-articles/  # 目撃情報記事生成
│
├── scripts/newreleases/
│   ├── generate-images.js                # 画像生成スクリプト
│   └── post-wordpress.js                 # WordPress投稿スクリプト
│
├── config/
│   ├── sightings.json                    # 目撃情報テーマ設定
│   └── newreleases.json                  # 抽選販売カテゴリ設定
│
├── output/
│   ├── new-releases/
│   │   ├── raw/{date}/                   # 収集したrawデータ
│   │   ├── drafts/{date}/                # 生成した記事
│   │   └── images/{date}/                # 生成した画像
│   └── blog/
│       └── raw/                          # 目撃情報rawデータ
│
└── docs/
    └── newreleases-architecture.md       # アーキテクチャドキュメント
```

## スクリプト

```bash
# 抽選販売
npm run newreleases:images    # 画像生成
npm run newreleases:post      # WordPress投稿

# 目撃情報
npm run scrape:yahoo          # Yahoo経由でX収集
npm run scrape:threads        # Threads収集
npm run generate:articles     # 記事生成
npm run post:wordpress        # WordPress投稿
```

## 運用

### 自動実行（cron）

```cron
# 抽選販売パイプライン: 毎日 7:00 / 13:00 / 19:00
0 7,13,19 * * * cd /path/to/seal-mania-claude && claude -p "/newreleases-pipeline"

# 目撃情報収集: 毎日 6:00 / 12:00 / 18:00
0 6,12,18 * * * cd /path/to/seal-mania-claude && npm run scrape:all
```
