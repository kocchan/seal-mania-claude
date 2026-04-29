# X目撃情報収集スキル

X（Twitter）から目撃情報を収集する。

検索キーワードは `config.json` の `theme.name` から取得する。

## 概要

Yahooリアルタイム検索をスクレイピングして、Xの最新投稿を取得する。

## 機能

- **時間変換**: 相対時間（「3分前」「昨日 22:15」）を実際の日時（ISO 8601形式）に変換
- **重複除外**: 前回実行時に取得済みの投稿は除外（直近5ファイルのURLと比較）

## 実行方法

以下のスクリプトを実行する。

```bash
node .claude/skills/collect-x/scrape-yahoo.js
```

## スクリプト

`.claude/skills/collect-x/scrape-yahoo.js`

Playwrightを使ってYahooリアルタイム検索をスクレイピングする。

## 出力

`output/blog/raw/yahoo-{timestamp}.json`

```json
{
  "query": "ボンボンドロップシール",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "source": "yahoo_realtime",
  "platform": "x",
  "count": 10,
  "data": [
    {
      "text": "投稿内容",
      "user": "ユーザー名",
      "time": "2024-01-01T12:00:00.000Z",
      "timeRaw": "3分前",
      "url": "投稿URL"
    }
  ]
}
```

## 実行タイミング

GitHub Actionsで1時間ごとに自動実行（8:00〜24:00 JST）
