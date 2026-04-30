# X目撃情報収集スキル

X（Twitter）から目撃情報を収集する。

検索キーワードは `config.json` の `queries` から取得する。

## 概要

Yahooリアルタイム検索をスクレイピングして、Xの最新投稿を取得する。

## 機能

- **複数クエリ対応**: config.jsonで複数の検索クエリを設定可能
- **時間変換**: 相対時間（「3分前」「昨日 22:15」）をtimestampを基準に実際の日時に変換
- **1日1ファイル**: 同じ日に複数回実行しても1つのファイルに追記
- **重複除外**: 同じURLの投稿は除外
- **自動BAN**: NGワード/URL検出時にブラックリストに追加
- **公式アカウント除外**: 設定した公式アカウントは除外

## 実行方法

以下のスクリプトを実行する。

```bash
node scripts/sightings/scrape-yahoo.js
```

## スクリプト

- `scripts/sightings/scrape-yahoo.js` - メインスクリプト
- `scripts/sightings/utils.js` - 共通ユーティリティ

## 設定

`config.json` で以下を設定:

```json
{
  "queries": ["検索クエリ1", "検索クエリ2"],
  "filter": {
    "officialAccounts": ["除外するユーザーID"],
    "ngWords": ["プレゼント", "懸賞"],
    "ngUrls": ["amzn.to"]
  },
  "scraping": {
    "headless": true,
    "queryDelay": 3000
  }
}
```

## 出力

`output/sightings/raw/yahoo-{YYYY-MM-DD}.json`

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "source": "yahoo_realtime",
  "platform": "x",
  "count": 10,
  "data": [
    {
      "tweetId": "1234567890",
      "userId": "username",
      "text": "投稿内容",
      "user": "表示名",
      "time": "2024-01-01T12:00:00.000Z",
      "timeRaw": "3分前",
      "url": "https://x.com/username/status/1234567890",
      "hashtags": ["#タグ"],
      "images": ["画像URL"]
    }
  ]
}
```

## ブラックリスト

`output/sightings/blacklist.json` に自動BANされたユーザーが保存される。

## 実行タイミング

GitHub Actionsで1時間ごとに自動実行（8:00〜24:00 JST）
