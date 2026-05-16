# RSS抽選情報記事生成スキル

`output/rss/` に保存されたRSS収集データから**抽選販売情報**を選別し、WordPress投稿用の記事を生成して `output/lottery-info/drafts/` に保存する。

**このスキルの役割**: `output/rss/{date}/` → 抽選情報を抽出 → 記事生成 → `output/lottery-info/drafts/{date}/`

**新作情報は別スキル**: `/rss-newproduct-article` で実行

**LivePocket収集との違い**: 既存の `/lotteryinfo-generate-article` はLivePocket等から直接収集したrawデータが入力。本スキルはRSSフィード（Google アラート等）経由で集めた**ニュース記事・SNS投稿**から抽選情報を抽出するのが入力。

## 実行方法

```bash
claude "/rss-lottery-article"
```

## 入力

`output/rss/{date}/*.md` のMarkdownファイル

各ファイルは以下のスキーマを持つ:
```yaml
---
source: rss
url: "https://..."             # 元記事のURL
title: "..."                   # 元記事のog:title
siteName: "..."                # 元サイト名
publishedAt: "..."             # 公開日時
fetchedAt: "..."               # 取得日時
fetchMethod: axios | playwright
ogImage: "..."                 # アイキャッチ画像URL（あれば）
description: "..."             # og:description
---

## RSS要約
{RSSフィードのsummary}

## 本文HTML（サニタイズ済み）
{記事HTML}
```

## 出力

`output/lottery-info/drafts/{date}/{slug}.md`

※既存の `/lotteryinfo-generate-article` と同じ出力先・スキーマで保存し、下流の `/lotteryinfo-images`・`/lotteryinfo-post` をそのまま流用する。

## タスク

### 0. 現在時刻の確認

```bash
date "+%Y-%m-%d %H:%M:%S %Z"
```

### 1. 抽選情報の選別

`output/rss/` 配下の各 .md ファイルを走査し、以下のキーワードが **title または description または 本文** に含まれるものを抽選情報候補として抽出する:

**抽選キーワード（いずれか1つ以上ヒット）:**
- 抽選販売 / 公式抽選 / 抽選会 / 当選 / 抽選応募
- 受付中 / 受付期間 / 申込締切 / 応募締切 / 締切
- 応募方法 / 申込方法 / 申し込み / エントリー
- LivePocket / livepocket.jp / リブポケット
- 予約販売 / 予約受付 / 事前抽選
- 当選発表 / 当選者発表

**除外キーワード**（含まれていたらスキップ）:
- 完売 / 終了 / 締切済 / 受付終了 / 当選発表済

### 2. 締切が現在時刻より後のものに限定

本文から締切日時を抽出し、**現在時刻 < 締切** のもののみ処理対象とする。

締切が文中で見つからない場合は、`publishedAt` が直近7日以内のものを処理対象とする。

### 3. 重複チェック

既存ドラフトをチェックし、同じ元URLが既に処理済みであればスキップ:

```bash
grep -rl "sourceRssUrl" output/lottery-info/drafts/ 2>/dev/null | xargs grep -l "{対象URL}" 2>/dev/null
```

### 4. 記事生成

**目標文字数: 3,000〜5,000文字**

#### タイトル形式（32文字以内推奨）

```
【{締切日}締切】{商品名}の抽選販売@{店舗・主催}
```

例:
- 【5/22締切】マリーンズ ボンドロ抽選@千葉ロッテ
- 【5/30締切】サンリオmoji抽選@梅田ロフト

#### 見出し構成

```markdown
# 【{締切日}締切】{商品名}の抽選販売が{店舗名}で開催！

{導入文: 200文字程度}

## 抽選・イベントの概要

## 購入できる商品一覧

## 応募方法・申込手順

## 注意点

### 申込は1人1回まで
### 本人確認が必須
### 代理購入・譲渡について
### 当日フリー販売について
### 遅刻・キャンセルについて

## よくある質問（FAQ）

## 抽選に申し込む

## 店舗情報・アクセス

## 抽選に外れた場合の購入方法

## まとめ
```

詳細テンプレートは `/lotteryinfo-generate-article` と同じ構成（FAQ・通販リンク・まとめ）に揃える。

### 5. frontmatter

```yaml
---
type: lottery
status: draft
title: "【5/22締切】マリーンズ ボンボンドロップシール抽選@千葉ロッテ"
description: "千葉ロッテ公式マリーンズボンボンドロップシール抽選販売の応募方法・対象商品・締切を解説。"
slug: "marines-bondoro-20260522"
category: "抽選販売"
tags:
  - ボンボンドロップシール
  - 千葉ロッテ
  - 抽選販売
store: "千葉ロッテマリーンズ オンラインショップ"
deadline: "2026-05-22T23:59:00+09:00"
applyUrl: "https://..."
featuredImage: "{ogImage か元記事の og:image}"
source: rss                         # ← RSS 経由であることを示す
sourceRssUrl: "{rss frontmatter の url}"
sourceFile: "output/rss/{date}/{slug}.md"
createdAt: "..."
updatedAt: "..."
---
```

### 6. ファイル保存

出力: `output/lottery-info/drafts/{date}/{slug}.md`

slug生成ルール:
- 元RSSの主催/店舗を簡略化（ローマ字）
- 商品キーワードを付与
- 日付（締切年月日）を付与

### 7. git commit & push

```bash
git add output/lottery-info/drafts/
git commit -m "chore: RSS抽選情報から記事生成 [skip ci]"
git push
```

### 8. 完了メッセージ

```
✅ RSS抽選情報の記事生成完了: {件数}件

保存先: output/lottery-info/drafts/{date}/
- {ファイル1}
- {ファイル2}

👉 画像生成: npm run lotteryinfo:images
👉 WordPress投稿: npm run lotteryinfo:post
```

## 品質チェックリスト

- [ ] title に締切日が入っている
- [ ] title が32文字以内
- [ ] description が120文字以内
- [ ] 本文3,000文字以上
- [ ] 商品リストがある
- [ ] 締切が現在時刻より後
- [ ] sourceRssUrl が元RSSと一致
- [ ] 同URLの既存ドラフトと重複していない

## 入出力サマリ

| 種類 | パス |
|------|------|
| 入力 | `output/rss/{date}/*.md` |
| 出力 | `output/lottery-info/drafts/{date}/{slug}.md` |
| 重複チェック | 既存 `output/lottery-info/drafts/**/*.md` の `sourceRssUrl` |

## 下流スキル

このスキルが出力した drafts は、既存パイプラインの後続スキルでそのまま処理可能:

```
rss-lottery-article  →  lotteryinfo-images  →  lotteryinfo-post
   (記事生成)              (画像生成)             (WordPress)
```

`/rss-lottery-pipeline` でこの一連を一括実行できる。
