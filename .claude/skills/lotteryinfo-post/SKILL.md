# 抽選販売記事投稿スキル

draftsの記事をWordPressに投稿する。

**このスキルの役割**: `output/lottery-info/drafts/` の記事 → WordPress投稿

## 実行モード

このスキルには2つの実行モードがある。実行コンテキストにより自動的に使い分ける。

### モード判定

- **routine（Claude Code のリモート実行 / CCR / Anthropic Cloud 環境）から呼ばれた場合** → モード B（GitHub Actions経由）
  - 理由: リモート環境からは ConoHa WING の WordPress サーバーへ到達できないため、API直叩きは失敗する
  - 判定の目安: ローカルの `.env` が読めない / `WP_API_URL` 環境変数が未設定 / リモート routine 配下で動作している
- **それ以外（ローカル開発機、`claude` CLI を手動実行 等）** → モード A（直接API投稿）

迷ったら、`process.env.WP_API_URL` の有無で判定する。未設定ならモード B。

---

### モード A: 直接API投稿（ローカル実行）

WordPress サーバーへ直接到達できる環境で実行する場合。

```bash
npm run lotteryinfo:post
```

これにより `scripts/lotteryinfo/post-wordpress.js` が起動し、後述の処理フロー（1〜8）を全て実行する。

完了後、frontmatter の更新（`posted: true` 等）をコミット & プッシュ:

```bash
git add output/lottery-info/drafts/
git commit -m "chore: 抽選販売記事を投稿 [skip ci]"
git push
```

---

### モード B: GitHub Actions 経由（routine 実行）

リモート routine から呼ばれ、WordPress サーバーへ到達できない場合。

**実装方針**: 自分では投稿せず、`output/lottery-info/drafts/` への変更を main にコミット & プッシュするだけで、`.github/workflows/post-wordpress.yml` が path filter (`output/lottery-info/drafts/**/*.md`) で自動起動する。GitHub Actions runner 上で `npm run lotteryinfo:post` が実行され、投稿および frontmatter 更新が完結する。

routine 側でやること:

```bash
# drafts と images を main にコミット & プッシュ
git add output/lottery-info/
git commit -m "chore: 抽選販売パイプライン実行 [skip ci]"
git push
```

push と同時に Actions ワークフロー `抽選販売記事 WordPress投稿` が自動起動する。完了は GitHub の Actions タブで確認。

明示的に起動したい場合（path filter にかからないケース等）:

```bash
gh workflow run post-wordpress.yml --ref main
```

routine 側はワークフローの完了を待たずに終了して良い（Actions が完了時に `posted: true` 等を別コミットで反映する）。

**必要な GitHub Secrets**: `WP_API_URL`, `WP_USER`, `WP_APP_PASSWORD`, `YAHOO_CLIENT_ID`, `AMAZON_ASSOCIATE_ID`, `RAKUTEN_AFFILIATE_ID`

---

## 入力

`output/lottery-info/drafts/{date}/{slug}.md`

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

## 処理フロー（モード A・B 共通の最終的な挙動）

### 1. 対象ファイルを検索

```bash
ls output/lottery-info/drafts/
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

`output/lottery-info/images/{date}/{slug}.png` をWordPressにアップロード

### 4. カテゴリ設定

カテゴリは `config/lotteryinfo.json` で管理:

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

タグは `config/lotteryinfo.json` の `defaultTags` で管理:

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

モード A（ローカル）ではプロジェクト直下の `.env` を使用。モード B（GitHub Actions）では Repository Secrets に同名で登録する。

## 入出力まとめ

| 種類 | パス |
|------|------|
| 入力 | `output/lottery-info/drafts/{date}/{slug}.md` (imageGenerated: true, posted: なし) |
| 入力 | `output/lottery-info/images/{date}/{slug}.png` |
| 出力 | WordPress記事 |
| 出力 | mdファイルに `posted: true` を追加 |

## git commit & push

### モード A（ローカル）

投稿後、自分で実行:

```bash
git add output/lottery-info/drafts/
git commit -m "chore: 抽選販売記事を投稿 [skip ci]"
git push
```

### モード B（GitHub Actions）

routine 自身は drafts/images を `chore: 抽選販売パイプライン実行 [skip ci]` でコミット & プッシュするだけ。投稿成功後の `posted: true` 反映コミットは GitHub Actions ワークフロー (`post-wordpress.yml`) が `chore: 抽選販売記事のpostedフラグ更新 [skip ci]` で別途行う。
