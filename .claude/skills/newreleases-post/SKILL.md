# 抽選販売記事投稿スキル

draftsの記事をWordPressに投稿する。

**このスキルの役割**: `output/new-releases/drafts/` の記事 → WordPress投稿

## 実行方法

```bash
claude "/newreleases-post"
```

または

```bash
npm run newreleases:post
```

## 入力

`output/new-releases/drafts/{date}/{slug}.md`

対象条件:
- `imageGenerated: true` があるもの
- `posted: true` が**ない**もの

## 出力

- WordPress記事（公開状態）
- 対象mdファイルの frontmatter に以下を追加:
  - `posted: true`
  - `wpPostId: 12345`
  - `wpPostUrl: "https://..."`
  - `postedAt: "2026-05-06T..."`

## 処理フロー

### 1. 対象ファイルを検索

```bash
ls output/new-releases/drafts/
```

各ファイルの frontmatter を確認:
- `imageGenerated: true` → 対象
- `posted: true` → スキップ

### 2. Markdown → HTML 変換

記事本文をHTMLに変換:
- 見出し: `## タイトル` → `<h2>タイトル</h2>`
- 太字: `**テキスト**` → `<strong>テキスト</strong>`
- リンク: `[テキスト](URL)` → `<a href="URL">テキスト</a>`
- リスト: `- 項目` → `<li>項目</li>`
- テーブル: Markdown表 → `<table>`

### 3. アイキャッチ画像アップロード

`output/new-releases/images/{date}/{slug}.png` をWordPressにアップロード

### 4. カテゴリ設定

カテゴリは `config/newreleases.json` で管理:

```json
{
  "wordpress": {
    "categoryMap": {
      "抽選・予約情報": 918,
      "オンライン通販": 919,
      "キャラクターシール": 928,
      "ディズニー": 929,
      "サンリオ": 930,
      "ちいかわ": 933
    },
    "characterCategories": {
      "ちいかわ": 933,
      "サンリオ": 930,
      "moji": 930,
      "ディズニー": 929
    }
  }
}
```

frontmatterのtagsから自動判定:
- `characterCategories` のキーワードがタグに含まれる → 対応カテゴリを追加
- 店舗名に「ネット」「オンライン」含む → オンライン通販カテゴリを追加

### 5. タグ設定

タグは `config/newreleases.json` の `defaultTags` で管理:

```json
{
  "wordpress": {
    "defaultTags": ["抽選販売", "ボンボンドロップシール"]
  }
}
```

- defaultTagsを自動作成/取得
- frontmatterのtagsから最大5件追加

### 6. アフィリエイトリンク追加

Yahoo!ショッピングAPIで商品を検索し、記事末尾に追加:
- Amazon
- 楽天市場
- Yahoo!ショッピング

### 7. WordPress投稿

```json
{
  "title": "【5/6締切】ちいかわボンドロ抽選@パーティリコ",
  "content": "<h2>...</h2>...",
  "status": "publish",
  "slug": "partyrico-fujimi-chiikawa",
  "categories": [918, 933, 928],
  "tags": [抽選販売ID, ボンボンドロップシールID, ...],
  "featured_media": 画像ID
}
```

### 8. frontmatter更新

投稿成功後、mdファイルを更新:

```yaml
---
posted: true
wpPostId: 12345
wpPostUrl: "https://your-site.com/..."
postedAt: "2026-05-06T17:00:00+09:00"
imageGenerated: true
type: lottery
# ... 他のフィールド
---
```

### 9. 完了メッセージ

```
✅ WordPress投稿完了: {件数}件

投稿した記事:
- {タイトル1}: {URL1}
- {タイトル2}: {URL2}
```

## 環境変数

```
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_USER=username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id
YAHOO_CLIENT_ID=your-yahoo-client-id
```

## 入出力まとめ

| 種類 | パス |
|------|------|
| 入力 | `output/new-releases/drafts/{date}/{slug}.md` (imageGenerated: true, posted: なし) |
| 入力 | `output/new-releases/images/{date}/{slug}.png` |
| 出力 | WordPress記事 |
| 出力 | mdファイルに `posted: true` を追加 |

## git commit & push

投稿後、以下を実行:

```bash
git add output/new-releases/drafts/
git commit -m "chore: 抽選販売記事を投稿 [skip ci]"
git push
```
