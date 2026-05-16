# RSS新作情報記事生成スキル

`output/rss/` に保存されたRSS収集データから**新作情報**を選別し、WordPress投稿用の記事を生成して `output/newproduct/drafts/` に保存する。

**このスキルの役割**: `output/rss/{date}/` → 新作情報を抽出 → 記事生成 → `output/newproduct/drafts/{date}/`

**抽選情報は別スキル**: `/rss-lottery-article` で実行

## 実行方法

```bash
claude "/rss-newproduct-article"
```

## 入力

`output/rss/{date}/*.md` のMarkdownファイル

スキーマは `/rss-lottery-article` と同じ:
```yaml
---
source: rss
url: "..."
title: "..."
siteName: "..."
publishedAt: "..."
fetchedAt: "..."
fetchMethod: axios | playwright
ogImage: "..."
description: "..."
---

## RSS要約
...

## 本文HTML（サニタイズ済み）
...
```

## 出力

`output/newproduct/drafts/{date}/{slug}.md`

※ `output/newproduct/` は本スキル用の新規ディレクトリ。下流の画像生成・WordPress投稿スキルは現状未整備（将来追加予定）。

## タスク

### 0. 現在時刻の確認

```bash
date "+%Y-%m-%d %H:%M:%S %Z"
```

### 1. 新作情報の選別

各RSS .md ファイルを走査し、以下のキーワードが **title または description または 本文** に含まれるものを新作情報候補として抽出する:

**新作キーワード（いずれか1つ以上ヒット）:**
- 新発売 / 新作 / 新商品 / 新登場
- 発売開始 / 発売日 / 発売予定 / リリース
- コラボ / コラボレーション / 限定発売
- ◯月◯日発売 / 5/X発売
- 登場 / 開始 / 解禁

**除外キーワード**（含まれていたら抽選扱いなのでスキップ）:
- 抽選販売 / 公式抽選 / 応募 / 当選 / LivePocket

→ 抽選キーワードが含まれる場合は `/rss-lottery-article` 側で処理されるため、こちらでは扱わない。

### 2. 信頼できる情報源に限定

ニュース記事（news.yahoo.co.jp, inside-games.jp, chiba-tv.com, prtimes.jp, ameba.jp, ohbsn.com 等）・公式サイト・公式X等を優先。

**スキップ対象（情報量が少ない or 二次情報）:**
- Yahoo!フリマ等のフリマ出品ページ
- 個人ブログのアフィリエイト記事
- Threads / Instagram 等のSNS本文だけのもの（参考として下部に引用は可）

### 3. 重複チェック

```bash
grep -rl "sourceRssUrl" output/newproduct/drafts/ 2>/dev/null | xargs grep -l "{対象URL}" 2>/dev/null
```

同URL既処理ならスキップ。

### 4. 記事生成

**目標文字数: 2,500〜4,000文字**

#### タイトル形式（32文字以内推奨）

```
【{発売日}発売】{商品名} - {キャラ/ブランド}新作レビュー
```

例:
- 【5/22発売】マリーンズ ボンドロ - 千葉ロッテ3D新作
- 【5/16発売】ナルミヤ×サーティワン ぷっくりシール

#### 見出し構成

```markdown
# {記事タイトル}

{導入文: 150〜200文字}

## 商品概要

{商品の特徴・販売元・コラボ情報を整理}

## 商品ラインナップ

| 商品名 | 価格（税込） | ポイント |
|--------|-------------|----------|
| {商品1} | {価格} | {特徴} |
| {商品2} | {価格} | {特徴} |

## 発売情報

| 項目 | 内容 |
|------|------|
| 発売日 | {日付} |
| 販売場所 | {店舗 or オンライン} |
| 価格 | {価格帯} |
| 入手難易度 | {予測} |

## 商品の魅力・見どころ

{元記事の本文を要約・再構成。立体感、デザイン、コラボ理由など}

## どこで買える？

{販売場所一覧}

## 通販で探す

- [Amazonで「{商品名}」を探す](https://www.amazon.co.jp/s?k={URLエンコード})
- [楽天市場で「{商品名}」を探す](https://search.rakuten.co.jp/search/mall/{URLエンコード})
- [Yahoo!ショッピングで「{商品名}」を探す](https://shopping.yahoo.co.jp/search?p={URLエンコード})

## 関連情報

{元記事リンク・公式情報を整理}

## まとめ

{要点を箇条書きで再掲し、入手方法を再提示}
```

### 5. frontmatter

```yaml
---
type: newproduct
status: draft
title: "【5/16発売】ナルミヤ×サーティワン ぷっくりシール登場"
description: "ナルミヤとサーティワンのコラボぷっくりシールが5月16日発売。商品ラインナップ・販売場所・価格を解説。"
slug: "narumiya-31-pukkuri-20260516"
category: "新作情報"
tags:
  - ボンボンドロップシール
  - 新作
  - ナルミヤ
  - サーティワン
brand: "ナルミヤ × サーティワン"
salesDate: "2026-05-16"
priceRange: "550〜880円"
featuredImage: "{rss frontmatter の ogImage}"
source: rss
sourceRssUrl: "{rss frontmatter の url}"
sourceFile: "output/rss/{date}/{slug}.md"
createdAt: "..."
updatedAt: "..."
---
```

### 6. ファイル保存

出力: `output/newproduct/drafts/{date}/{slug}.md`

ディレクトリがなければ作成: `mkdir -p output/newproduct/drafts/{date}`

slug生成ルール:
- ブランド/コラボ先をローマ字化
- 商品/キャラクターキーワードを付与
- 発売日をyyyymmddで付与

### 7. git commit & push

```bash
git add output/newproduct/drafts/
git commit -m "chore: RSS新作情報から記事生成 [skip ci]"
git push
```

### 8. 完了メッセージ

```
✅ RSS新作情報の記事生成完了: {件数}件

保存先: output/newproduct/drafts/{date}/
- {ファイル1}
- {ファイル2}

※ 画像生成・WordPress投稿スキルは現状未整備のため、手動で WordPress にコピー＆ペーストするか、後続の専用スクリプト整備をお待ちください。
```

## 品質チェックリスト

- [ ] title に発売日が入っている
- [ ] title が32文字以内
- [ ] description が120文字以内
- [ ] 本文2,500文字以上
- [ ] 商品ラインナップ表がある
- [ ] 発売情報表がある
- [ ] 通販リンクが3つある
- [ ] 元記事URL（sourceRssUrl）が記事に明記されている
- [ ] 同URLの既存ドラフトと重複していない

## 入出力サマリ

| 種類 | パス |
|------|------|
| 入力 | `output/rss/{date}/*.md` |
| 出力 | `output/newproduct/drafts/{date}/{slug}.md` |
| 重複チェック | 既存 `output/newproduct/drafts/**/*.md` の `sourceRssUrl` |

## 抽選情報との振り分け

| 条件 | 担当スキル |
|------|----------|
| 「抽選販売」「LivePocket」「応募」等を含む | `/rss-lottery-article` |
| 「新発売」「コラボ」「◯月発売」等を含み抽選キーワードを含まない | `/rss-newproduct-article`（このスキル） |
| どちらにも該当しない（雑談・関連紹介） | スキップ |
