# RSS スクレイプ

ボンボンドロップシールの新作情報を、Google アラート等の RSS フィードから日次で取得し、各記事 URL をスクレイピングして本文・OGP 画像を保存する。

## データフロー

```
RSS フィード (Google アラート等)
        │
        ▼
┌────────────────────────┐
│ scripts/rss/scrape.js  │
└────────────────────────┘
    1. Atom/RSS パース（cheerio xmlMode）
    2. Google リダイレクト URL から実URL抽出
    3. 既存ファイルとの URL 重複チェック
    4. axios で記事 HTML 取得
       └─ 本文 < 200 chars 等の場合 Playwright フォールバック
    5. og:image / 本文HTML 抽出 + サニタイズ
    6. Markdown として保存
        │
        ▼
output/rss/{date}/{slug}.md
```

## ファイル命名

```
output/rss/2026-05-16/prtimes-jp-000000023.md
                          │           └─ {host}-{path末尾}
                          └─ JST 日付
```

## 出力フォーマット

```yaml
---
source: rss
url: "https://prtimes.jp/main/html/rd/p/000000023.html"
title: "新作ボンボンドロップシール発売のお知らせ"
siteName: "PR TIMES"
publishedAt: "Thu, 16 May 2026 09:00:00 +0900"
fetchedAt: "2026-05-16T00:05:32.000Z"
fetchMethod: axios
ogImage: "https://prtimes.jp/i/.../resize/d.jpg"
description: "サンリオ×ボンボンドロップシール..."
---

## RSS要約

(RSS フィードの summary/description)

## 本文HTML（サニタイズ済み）

<article>...</article>
```

## 設定

### config/rss.json

```json
{
  "rss": {
    "feedUrlsEnv": "RSS_FEED_URLS",
    "maxItemsPerFeed": 30,
    "filterKeywords": ["シール"]
  },
  "output": { "rssDir": "output/rss" },
  "scraping": {
    "timeoutMs": 20000,
    "userAgent": "Mozilla/5.0 ...",
    "minBodyChars": 200,
    "useFallbackPlaywright": true,
    "delayMsBetweenRequests": 1000
  }
}
```

### .env / GitHub Secrets

```
RSS_FEED_URLS=https://www.google.com/alerts/feeds/XXXX/YYYY,https://www.google.com/alerts/feeds/XXXX/ZZZZ
```

複数 URL をカンマで区切って指定する。

## Google アラート RSS の取得方法

1. <https://www.google.com/alerts> にアクセス
2. キーワード「ボンボンドロップシール」等で新規アラート作成
3. **「配信先」を「RSS フィード」に変更**
4. 作成後、ベル🔔アイコンから RSS の URL をコピー
5. その URL を `RSS_FEED_URLS` に追加

## 実行方法

### ローカル

```bash
# .env に RSS_FEED_URLS を設定してから
npm run rss:scrape
```

### GitHub Actions

`.github/workflows/rss-scrape.yml` が毎日 9:00 JST (00:00 UTC) に自動実行する。
手動実行は GitHub の Actions タブから "Run workflow" 可能。

### 必要な GitHub Secrets

| 名前 | 説明 |
|------|------|
| `RSS_FEED_URLS` | カンマ区切りの RSS フィード URL |

## スクレイピングの仕組み

| 手法 | 採用条件 | 速度 |
|------|----------|------|
| axios + cheerio | デフォルト | 速い |
| Playwright (chromium) | axios の本文が 200 文字未満、または axios が失敗 | 遅い（JS 評価あり） |

サニタイズ内容:
- `<script>`, `<style>`, `<noscript>`, `<iframe>`, `<object>`, `<embed>`, `<link rel="stylesheet">` を削除
- すべての要素から `on*` 属性と `style` 属性を削除

## 重複排除

既存の `output/rss/**/*.md` を起動時に走査し、frontmatter の `url:` 値を集合化して、新規アイテムが既存 URL と一致する場合はスキップする。

## キーワードフィルタ

`config/rss.json` の `rss.filterKeywords` に該当する文字列が、スクレイピング後の og:description（記事ページの description メタ）に含まれている場合のみ保存対象。`filterKeywords: []` にすればフィルタなし。

> 補足: フィルタは記事フェッチ後に行われるため、対象外の記事も一度は取得される。RSS タイトル段階での前処理はしていない（Google アラート等は title が「サイト名」になっていて記事内容を表していないケースが多いため）。
