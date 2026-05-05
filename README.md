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
│       ├── collect-x/          # X収集スキル
│       │   ├── SKILL.md
│       │   └── scrape-yahoo.js
│       └── collect-threads/    # Threads収集スキル
│           ├── SKILL.md
│           └── scrape-threads.js
└── output/
    └── blog/
        └── raw/          # 収集データ出力先
```
