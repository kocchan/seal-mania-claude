# 競合サイト分析スキル

競合ブログサイトのRSSフィードやサイトマップを取得し、記事内容を自動分析する。

## 概要

指定した競合サイトから最新記事を取得し、以下の観点で分析を行う:

- SEOキーワード抽出
- 記事構成（見出し構造）の分析
- マネタイズポイントの特定
- 自社サイトへの応用提案

## タスク

### 1. 競合サイトのRSS/サイトマップ取得

まずRSSフィードを試行し、なければサイトマップから取得する。

```bash
node scripts/fetch-competitor-feed.js --url "https://example.com"
```

取得先の優先順位:
1. `/feed` (WordPress標準RSS)
2. `/rss.xml`
3. `/feed.xml`
4. `/sitemap.xml`

### 2. 記事URLの収集

RSSまたはサイトマップから記事URLを抽出し、リスト化する。

出力: `output/competitor/urls/{domain}-{timestamp}.json`

```json
{
  "domain": "bonbon-navi.com",
  "fetchedAt": "2026-05-01T06:00:00+09:00",
  "source": "rss",
  "urls": [
    {
      "url": "https://bonbon-navi.com/article-1/",
      "title": "記事タイトル",
      "pubDate": "2026-04-30",
      "description": "記事の概要..."
    }
  ]
}
```

### 3. 記事本文の取得・保存

各記事URLからHTML本文を取得し、クリーンなテキストに変換する。

```bash
node scripts/scrape-competitor-article.js --url "https://example.com/article/"
```

出力: `output/competitor/raw/{domain}/{slug}.md`

```markdown
---
source: bonbon-navi.com
sourceUrl: "https://bonbon-navi.com/article-1/"
title: "記事タイトル"
pubDate: "2026-04-30"
fetchedAt: "2026-05-01T06:00:00+09:00"
---

# 記事タイトル

（本文テキスト）
```

### 4. Claude分析

取得した記事本文をClaudeで分析する。以下の観点で詳細レポートを生成:

#### 4.1 SEOキーワード分析

```
この記事で狙っているSEOキーワードを3つ推測してください。
各キーワードについて、なぜそう判断したか理由も説明してください。
```

#### 4.2 記事構成分析

```
この記事の見出し構成（H2, H3）を箇条書きで抽出し、
構成の特徴や工夫されている点を分析してください。
```

#### 4.3 マネタイズ分析

```
この記事内でユーザーに行動を促しているポイント
（アフィリエイトリンク、商品紹介、CTA等）を特定し、
その誘導テクニックを分析してください。
```

#### 4.4 自社応用提案

```
この記事の内容を踏まえ、自社サイトで差別化するために
追加すべき独自の見解や情報を3つ提案してください。
```

### 5. 分析レポート保存

分析結果を統合してレポートファイルを生成。

出力: `output/competitor/reports/{domain}/{slug}-analysis.md`

```markdown
---
source: bonbon-navi.com
sourceUrl: "https://..."
title: "記事タイトル"
analyzedAt: "2026-05-01T07:00:00+09:00"
---

# 競合記事分析レポート

## 基本情報

| 項目 | 値 |
|------|-----|
| サイト | bonbon-navi.com |
| 記事タイトル | ... |
| 公開日 | 2026-04-30 |
| 推定文字数 | 約2,500文字 |

## SEOキーワード分析

### メインキーワード
- **ボンボンドロップシール 新作** - 理由: タイトルと本文で繰り返し使用

### サブキーワード
- **サンリオ コラボ** - 理由: 見出しに含まれている
- **発売日 いつ** - 理由: FAQ形式で回答している

## 記事構成

```
H1: [記事タイトル]
  H2: 商品概要
    H3: 価格・発売日
    H3: 全種類一覧
  H2: 購入方法
    H3: 店舗販売
    H3: オンライン販売
  H2: まとめ
```

### 構成の特徴
- FAQ形式を採用して検索意図に直接回答
- 購入導線が記事中盤と末尾の2箇所に配置

## マネタイズポイント

1. **楽天アフィリエイト** (記事中盤)
   - 誘導文: 「お得に購入するなら楽天がおすすめ」

2. **店舗紹介リンク** (記事下部)
   - 誘導文: 「最寄りの店舗を探す」

## 自社サイトへの応用提案

1. **速報性の強化**: 発売日だけでなく入荷情報もリアルタイム更新
2. **ユーザー参加型コンテンツ**: 目撃情報の投稿機能を追加
3. **独自の深掘り情報**: デザイナーインタビューや制作秘話を追加
```

### 6. 通知（オプション）

環境変数 `SLACK_WEBHOOK_URL` が設定されている場合、Slackに通知。

```json
{
  "text": "📊 競合分析レポートを作成しました",
  "attachments": [
    {
      "color": "#4a90d9",
      "title": "bonbon-navi.com の記事を分析",
      "text": "分析記事数: 5件\nレポート: output/competitor/reports/..."
    }
  ]
}
```

## 入出力

| 種類 | パス |
|------|------|
| 設定 | `config/competitors.json` |
| 出力（URLs） | `output/competitor/urls/{domain}-{timestamp}.json` |
| 出力（raw） | `output/competitor/raw/{domain}/{slug}.md` |
| 出力（reports） | `output/competitor/reports/{domain}/{slug}-analysis.md` |

## 設定ファイル

`config/competitors.json` に分析対象のサイトを登録:

```json
{
  "competitors": [
    {
      "name": "ボンボンナビ",
      "domain": "bonbon-navi.com",
      "url": "https://bonbon-navi.com",
      "feedUrl": "https://bonbon-navi.com/feed",
      "enabled": true,
      "analysisFrequency": "daily"
    }
  ],
  "analysisOptions": {
    "maxArticlesPerRun": 5,
    "skipOlderThan": "7d",
    "includeImages": false
  }
}
```

## 使い方

### 手動実行

```bash
# 特定のサイトを分析
claude "/analyze-competitor https://bonbon-navi.com"

# 設定ファイルの全サイトを分析
claude "/analyze-competitor --all"

# 特定の記事のみ分析
claude "/analyze-competitor --article https://bonbon-navi.com/article-1/"
```

### 自動実行

cron: 毎日 5:00（新商品収集の1時間前）

```cron
0 5 * * * cd /path/to/seal-mania-claude && claude -p "/analyze-competitor --all"
```

## 参照ドキュメント

`docs/competitor/analysis-flow.md`
