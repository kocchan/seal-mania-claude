# RSSめじるしアクセサリー新作記事生成スキル

`output/rss/` に保存されたRSS収集データから**めじるしアクセサリー（目印チャーム）の新作・ガチャ情報**を選別し、WordPress投稿用の記事を生成して `output/mejirushi/drafts/` に保存する。

**このスキルの役割**: `output/rss/{date}/` → めじるし新作情報を抽出 → 記事生成 → `output/mejirushi/drafts/{date}/`

**シールの新作は別スキル**: `/rss-newproduct-article` で実行（こちらでは扱わない）

## 実行方法

```bash
claude "/rss-mejirushi-article"
```

## 入力

`output/rss/{date}/*.md` のMarkdownファイル（スキーマは `/rss-newproduct-article` と同じ）

## 出力

`output/mejirushi/drafts/{date}/{slug}.md`

## タスク

### 0. 現在時刻の確認

```bash
date "+%Y-%m-%d %H:%M:%S %Z"
```

### 1. めじるし新作情報の選別

各RSS .md ファイルを走査し、以下を**両方**満たすものを抽出する:

**A. めじるしキーワード（いずれか1つ以上ヒット）:**
- めじるしアクセサリー / めじるしチャーム / 目印チャーム
- めじるし（単体。ただし文脈がチャーム・グッズであること）

**B. 新作キーワード（いずれか1つ以上ヒット）:**
- 新発売 / 新作 / 新商品 / 新登場 / 新弾
- 発売開始 / 発売日 / 発売予定 / リリース / 再販
- コラボ / 限定 / ◯月◯日発売
- ガチャ / ガシャポン / カプセルトイ に登場

**除外（ヒットしたらスキップ）:**
- シールが主題のもの（ボンボンドロップシール / うるちゅる 等が主役）→ `/rss-newproduct-article` 側
- 抽選販売 / 公式抽選 / 応募 / LivePocket（抽選パイプラインは現状めじるしでは未運用）
- フリマ出品・個人の売買投稿

### 2. 信頼できる情報源に限定

ニュース記事・公式サイト（バンダイ/ガシャポン公式、サンリオ公式等）・プレスリリース（prtimes.jp）を優先。
SNS本文だけのものはスキップ（参考引用は可）。

### 3. 重複チェック

```bash
grep -rl "sourceRssUrl" output/mejirushi/drafts/ 2>/dev/null | xargs grep -l "{対象URL}" 2>/dev/null
```

同URL既処理ならスキップ。

### 4. 記事生成

**目標文字数: 2,500〜4,000文字**
**読者層: 女子小中学生〜若い女性。です・ます調で、かわいさが伝わる表現を使う**

#### タイトル形式（32文字以内推奨）

```
【{発売日}発売】{商品名} - めじるしアクセサリー新作
```

例:
- 【8/1発売】サンリオ クリスタルめじるしアクセサリー第2弾
- 【7月新弾】ちいかわ めじるしチャーム ガチャに登場

#### 見出し構成

```markdown
# {記事タイトル}

{導入文: 150〜200文字。何のキャラ・どこのガチャで買えるかを先に}

## 商品概要

{商品の特徴・販売元・シリーズ情報を整理}

## ラインナップ

| 種類 | ポイント |
|------|----------|
| {種類1} | {特徴} |
| {種類2} | {特徴} |

## 発売情報

| 項目 | 内容 |
|------|------|
| 発売日 | {日付} |
| 販売形態 | {ガチャ（1回◯円）/ 店頭 / オンライン} |
| 価格 | {価格} |
| 設置場所 | {ガシャポンのデパート・ショッピングモール等} |

## ここがかわいい！見どころ

{デザイン・使い方（傘・バッグ・ボトルの目印）・推しキャラとの組み合わせ}

## どこで回せる？買える？

{設置場所・取扱店の探し方。ガシャポン公式の設置店検索などの案内}

## 通販で探す

- [Amazonで「{商品名}」を探す](https://www.amazon.co.jp/s?k={URLエンコード})
- [楽天市場で「{商品名}」を探す](https://search.rakuten.co.jp/search/mall/{URLエンコード})
- [Yahoo!ショッピングで「{商品名}」を探す](https://shopping.yahoo.co.jp/search?p={URLエンコード})

## 関連情報

{元記事リンク・公式情報}

## まとめ

{要点の箇条書き＋入手方法の再提示}
```

### 5. frontmatter

```yaml
---
type: mejirushi
status: draft
title: "【8/1発売】サンリオ クリスタルめじるしアクセサリー第2弾"
description: "サンリオのめじるしアクセサリー新弾が8月1日発売。ラインナップ・価格・設置場所を解説。"
slug: "sanrio-mejirushi-crystal2-20260801"
category: "新作・ガチャ情報"
tags:
  - めじるしアクセサリー
  - 新作
  - サンリオ
brand: "サンリオ"
salesDate: "2026-08-01"
priceRange: "300〜400円"
featuredImage: "{rss frontmatter の ogImage}"
source: rss
sourceRssUrl: "{rss frontmatter の url}"
sourceFile: "output/rss/{date}/{slug}.md"
createdAt: "..."
updatedAt: "..."
---
```

### 6. ファイル保存

出力: `output/mejirushi/drafts/{date}/{slug}.md`

ディレクトリがなければ作成: `mkdir -p output/mejirushi/drafts/{date}`

slug生成ルール:
- ブランド/キャラをローマ字化 + `mejirushi` + シリーズ名 + 発売日yyyymmdd

### 7. git commit & push

```bash
git add output/mejirushi/drafts/
git commit -m "chore: RSSめじるし新作情報から記事生成 [skip ci]"
git push
```

### 8. 完了メッセージ

```
✅ RSSめじるし新作情報の記事生成完了: {件数}件

保存先: output/mejirushi/drafts/{date}/
- {ファイル1}

※ WordPress投稿は post-wordpress.yml（毎日10:30 JST）の mejirushi:post が自動実行。
```

## 品質チェックリスト

- [ ] title に発売日または「新作」が入っている
- [ ] title が32文字以内
- [ ] description が120文字以内
- [ ] 本文2,500文字以上
- [ ] ラインナップ表・発売情報表がある
- [ ] 通販リンクが3つある
- [ ] 元記事URL（sourceRssUrl）が記事に明記されている
- [ ] シールが主題の記事を誤って拾っていない
- [ ] 同URLの既存ドラフトと重複していない

## 入出力サマリ

| 種類 | パス |
|------|------|
| 入力 | `output/rss/{date}/*.md` |
| 出力 | `output/mejirushi/drafts/{date}/{slug}.md` |
| 重複チェック | 既存 `output/mejirushi/drafts/**/*.md` の `sourceRssUrl` |

## 振り分けルール

| 条件 | 担当スキル |
|------|----------|
| めじるしアクセサリー/目印チャームが主題の新作 | `/rss-mejirushi-article`（このスキル） |
| シール（ボンドロ/うるちゅる等）が主題の新作 | `/rss-newproduct-article` |
| 抽選販売・応募系 | `/rss-lottery-article`（シールのみ） |
| どちらにも該当しない | スキップ |
