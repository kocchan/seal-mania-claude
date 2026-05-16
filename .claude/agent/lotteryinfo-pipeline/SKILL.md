# 抽選販売パイプライン（統合エージェント）

4つのスキルを順番に実行し、抽選販売情報の収集からWordPress投稿までを一括で行う。

## 実行方法

```bash
claude "/lotteryinfo-pipeline"
```

## パイプライン概要

```
[1. collect] → [2. generate-article] → [3. images] → [4. post]
     ↓                 ↓                    ↓              ↓
   raw/            drafts/              images/       WordPress
```

## 実行フロー

### Phase 1: 情報収集 (collect)

```bash
# スキル実行
/lotteryinfo-collect
```

**処理内容:**
- LivePocket/店舗Xから抽選情報を収集
- `output/lottery-info/raw/{date}/` にrawデータを保存

**成功条件:** rawファイルが1件以上生成されること

**失敗時:** エラーログを出力し、Phase 2に進まずに終了

### Phase 2: 記事生成 (generate-article)

```bash
# スキル実行
/lotteryinfo-generate-article
```

**処理内容:**
- rawデータを読み込み、WordPress用記事を生成
- `output/lottery-info/drafts/{date}/` に記事を保存

**成功条件:** draftsファイルが1件以上生成されること

**失敗時:** エラーログを出力し、Phase 3に進まずに終了

### Phase 3: 画像生成 (images)

```bash
# スキル実行
/lotteryinfo-images
```

**処理内容:**
- drafts記事を読み込み、Gemini AIでアイキャッチ画像を生成
- `output/lottery-info/images/{date}/` に画像を保存
- 処理済みdraftsに `imageGenerated: true` を追加

**成功条件:** `imageGenerated: true` のファイルが1件以上あること

**失敗時:** エラーログを出力し、Phase 4に進まずに終了

### Phase 4: WordPress投稿 (post)

```bash
# スキル実行
/lotteryinfo-post
```

**処理内容:**
- `imageGenerated: true` かつ `posted: true` でないdraftsを投稿
- WordPress REST APIで記事・画像をアップロード
- 投稿済みdraftsに `posted: true` を追加

**成功条件:** 投稿が1件以上成功すること

## 実行コマンド（一括）

各フェーズを順番に実行する:

```bash
# Phase 1: 情報収集
echo "=== Phase 1: 情報収集 ==="
# /lotteryinfo-collect を実行

# Phase 2: 記事生成
echo "=== Phase 2: 記事生成 ==="
# /lotteryinfo-generate-article を実行

# Phase 3: 画像生成
echo "=== Phase 3: 画像生成 ==="
npm run lotteryinfo:images

# Phase 4: WordPress投稿
echo "=== Phase 4: WordPress投稿 ==="
npm run lotteryinfo:post

# Phase 5: git push
echo "=== Phase 5: git commit & push ==="
git add output/lottery-info/
git commit -m "chore: 抽選販売パイプライン実行 [skip ci]"
git push
```

## エラーハンドリング

### Phase間の依存関係

| Phase | 依存 | 失敗時の処理 |
|-------|------|------------|
| 1. collect | なし | エラー出力して終了 |
| 2. generate-article | Phase 1 | rawがない場合はスキップ |
| 3. images | Phase 2 | draftsがない場合はスキップ |
| 4. post | Phase 3 | imageGenerated: falseはスキップ |

### リトライ戦略

- API呼び出し失敗: 3回までリトライ（指数バックオフ）
- ファイル書き込み失敗: 即座にエラー終了
- git push失敗: `git pull --rebase && git push` を試行

## 完了メッセージ

```
========================================
🎉 パイプライン完了！
========================================

📥 Phase 1 (収集): {n}件のrawデータを取得
📝 Phase 2 (記事): {n}件の記事を生成
🖼️ Phase 3 (画像): {n}件の画像を生成
🚀 Phase 4 (投稿): {n}件をWordPressに投稿

投稿した記事:
- {タイトル1}: {URL1}
- {タイトル2}: {URL2}
========================================
```

## cron設定（自動実行）

```cron
# 毎日 7:00 にパイプライン実行
0 7 * * * cd /path/to/seal-mania-claude && claude -p "/lotteryinfo-pipeline"
```

## 部分実行

特定のPhaseから開始したい場合:

```bash
# Phase 2から開始（rawデータは既にある）
claude "/lotteryinfo-generate-article"
npm run lotteryinfo:images
npm run lotteryinfo:post

# Phase 3から開始（draftsは既にある）
npm run lotteryinfo:images
npm run lotteryinfo:post

# Phase 4のみ（画像生成済み）
npm run lotteryinfo:post
```

## 入出力サマリー

| Phase | 入力 | 出力 |
|-------|------|------|
| 1. collect | Web (LivePocket/X) | `raw/{date}/*.md` |
| 2. generate-article | `raw/{date}/*.md` | `drafts/{date}/*.md` |
| 3. images | `drafts/{date}/*.md` | `images/{date}/*.png` + frontmatter更新 |
| 4. post | `drafts/{date}/*.md` + `images/{date}/*.png` | WordPress記事 + frontmatter更新 |

## 環境変数

パイプライン実行に必要な環境変数:

```env
# Gemini API（画像生成）
GEMINI_API_KEY=your-gemini-api-key

# WordPress
WP_API_URL=https://your-site.com/wp-json/wp/v2
WP_USER=your-username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# アフィリエイト
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id
YAHOO_CLIENT_ID=your-yahoo-client-id
```
