# seal-mania-claude

SNSから特定テーマの情報を自動収集するツール。

## テーマ設定

`config/sightings.json` でテーマを設定する。

```json
{
  "theme": {
    "name": "ボンボンドロップシール",
    "keywords": ["ボンボンドロップシール", "ボンドロ"]
  }
}
```

テーマを変更したい場合は `config/sightings.json` を編集するだけで、すべてのスキルに反映される。

## 機能

### X（Twitter）情報収集

Yahooリアルタイム検索経由でXの投稿を取得する。

```bash
node .claude/skills/collect-x/scrape-yahoo.js
```

- Playwrightでスクレイピング
- 出力: `output/blog/raw/yahoo-{timestamp}.json`

### Threads情報収集

Apify API経由でThreadsの投稿を取得する。

```bash
APIFY_TOKEN=xxx node .claude/skills/collect-threads/scrape-threads.js
```

- Apify Threads Scraperを使用
- 出力: `output/blog/raw/threads-{timestamp}.json`
- 要: Apifyアカウント（無料枠: $5/月）

## セットアップ

```bash
npm install
npx playwright install chromium
```

## フォルダ構成

```
seal-mania-claude/
├── config/
│   └── sightings.json    # テーマ設定
├── .claude/
│   └── skills/
│       ├── competitor-analyze/           # 競合分析
│       ├── sightings-collect-x/          # X目撃情報収集
│       │   ├── SKILL.md
│       │   └── scrape-yahoo.js
│       ├── sightings-collect-threads/    # Threads目撃情報収集
│       │   ├── SKILL.md
│       │   └── scrape-threads.js
│       ├── sightings-generate-articles/  # 目撃情報記事生成
│       ├── newreleases-collect/          # 新商品・抽選情報収集
│       ├── newreleases-generate-article/ # 抽選情報記事生成
│       ├── newreleases-brush-up/         # 記事ブラッシュアップ
│       ├── newreleases-post/             # 記事投稿
│       └── general-update-readme/        # README更新
└── output/
    └── blog/
        └── raw/          # 収集データ出力先
```
