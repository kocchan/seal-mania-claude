# Threads目撃情報収集スキル

Threadsから目撃情報を収集する。

検索キーワードは `config.json` の `theme.name` から取得する。

## 概要

Apify APIを使ってThreadsの最新投稿を取得する。

## 実行方法

以下のスクリプトを実行する。

```bash
APIFY_TOKEN=xxx node .claude/skills/collect-threads/scrape-threads.js
```

## スクリプト

`.claude/skills/collect-threads/scrape-threads.js`

Apify Threads Scraperを使って投稿を取得する。

## 必要な設定

- `APIFY_TOKEN`: Apify APIトークン
  - ローカル: `.env` に設定
  - GitHub Actions: Secretsに設定

## 出力

`output/blog/raw/threads-{timestamp}.json`

```json
{
  "query": "ボンボンドロップシール",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "source": "threads_apify",
  "platform": "threads",
  "count": 10,
  "data": [...]
}
```

## 実行タイミング

GitHub Actionsで1時間ごとに自動実行（8:00〜24:00 JST）

## コスト

Apify無料枠: $5/月
