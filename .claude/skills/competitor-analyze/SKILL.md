# 競合サイト分析スキル

競合サイトの構成・コンテンツ戦略・AI再現方法を分析する。

## 実行方法

```bash
claude "/competitor-analyze"
```

## フロー

### 1. サイト選択

起動時にAskUserQuestionで分析対象を質問する。

選択肢:
- `output/competitor/` 配下の既存フォルダ（過去に分析済みのサイト）
- その他（自由入力で新規サイトURL）

```
分析するサイトを選択してください:
- bonbon-navi.com（前回: 2026-05-05）
- [その他] 新しいサイトを入力
```

### 2. サイト情報取得

- トップページをWebFetchで取得
- RSSフィード（/feed）またはサイトマップ（/sitemap.xml）を取得
- 直近100記事のURLを収集し、本文を取得

### 3. 分析実行

以下の3観点で分析:

#### A. サイト構成
- サイトタイプ（WordPress等）
- カテゴリ構造
- URL設計
- 更新頻度

#### B. コンテンツ戦略
- SEOキーワード
- 記事テンプレート
- マネタイズ手法

#### C. AI再現プラン
- **データソース**: 具体的なAPI・アカウント名を特定（例: @LOFT_Official, LivePocket API）
- **自動化可能な部分**: 記事生成、画像、投稿
- **人間が必要な部分**: 正確性確認、独自取材

### 4. 結果保存

```
output/competitor/{domain}/
├── site.json       # サイト情報
└── analysis.md     # 分析レポート（端的に）
```

## 出力フォーマット

### site.json

```json
{
  "domain": "example.com",
  "feedUrl": "https://example.com/feed",
  "siteType": "wordpress",
  "analyzedAt": "2026-05-05",
  "latestArticles": [...]
}
```

### analysis.md

```markdown
# 競合分析: {domain}

## サイト構成
- タイプ: WordPress
- カテゴリ: 商品 / イベント / 地域別
- 更新: 1-2日ごと

## コンテンツ戦略
- SEO: 「商品名 + 店舗名」のロングテール
- テンプレ: 概要→商品→注意点→FAQ→まとめ
- 収益: Amazon/楽天アフィ + LINE獲得

## AI再現プラン

### データソース
| 情報 | 取得元 |
|------|--------|
| イベント情報 | 店舗公式X (@LOFT_Official 等) / LivePocket API |
| 商品情報 | メーカー公式サイト (例: epoch.jp) |
| 店舗情報 | Google Places API |
| 在庫状況 | X検索「商品名 入荷」/ Threads検索 |

### 自動化
- 記事生成: Claude API
- 画像: OGP自動生成
- 投稿: WordPress REST API

### 人間が必要
- 情報の正確性チェック
- 独自取材・コメント
```
