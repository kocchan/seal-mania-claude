# RSS抽選情報パイプライン（統合エージェント）

RSS収集データから抽選情報の記事を作り、画像生成・WordPress投稿までを一括で行う。

## 実行方法

```bash
claude "/rss-lottery-pipeline"
```

## パイプライン概要

```
[1. rss-lottery-article] → [2. lotteryinfo-images] → [3. lotteryinfo-post]
        ↓                          ↓                         ↓
output/lottery-info/drafts/   .../images/{date}/      WordPress公開
```

※ Phase 0（RSS 収集）は `.github/workflows/rss-scrape.yml` が毎日 9:00 JST に自動実行しているため、本パイプラインは Phase 1 から開始する。

## 実行フロー

### Phase 1: 記事生成（rss-lottery-article）

```bash
/rss-lottery-article
```

**処理内容:**
- `output/rss/{date}/*.md` を走査
- 抽選キーワード（抽選販売 / 受付 / 締切 / 応募 / LivePocket 等）が含まれる記事を抽出
- 締切が現在時刻より後のものに絞り込み
- 既存ドラフトとの重複チェック（sourceRssUrl）
- `output/lottery-info/drafts/{date}/{slug}.md` に記事生成

**成功条件:** drafts が1件以上生成、または「該当なし」で正常終了

**失敗時:** エラー出力して終了。Phase 2 には進まない。

### Phase 2: 画像生成（lotteryinfo-images）

```bash
npm run lotteryinfo:images
```

**処理内容:**
- `imageGenerated: true` でないドラフトに対し Gemini AI でアイキャッチ画像を生成
- `output/lottery-info/images/{date}/{slug}.png` に保存
- ドラフトの frontmatter に `imageGenerated: true` を追加

**成功条件:** すべて生成完了、または該当なしで終了

**失敗時:** エラー出力。Phase 3 はスキップ。

### Phase 3: WordPress投稿（lotteryinfo-post）

```bash
npm run lotteryinfo:post
```

**処理内容:**
- `imageGenerated: true` かつ `posted: true` でないドラフトをWordPress投稿
- 画像アップロード・カテゴリ設定・アフィリエイトリンク挿入を実施
- ドラフトの frontmatter に `posted: true`、`wpPostId`、`wpPostUrl` を追加

**成功条件:** 投稿が1件以上成功、または該当なしで終了

### Phase 4: git push

```bash
git add output/lottery-info/
git commit -m "chore: RSS抽選パイプライン実行 [skip ci]"
git push
```

新規ドラフト・画像・投稿フラグ更新をコミット & プッシュ。

## 実行コマンド（一括）

```bash
# Phase 1: 記事生成
echo "=== Phase 1: RSS抽選記事生成 ==="
# /rss-lottery-article を実行

# Phase 2: 画像生成
echo "=== Phase 2: 画像生成 ==="
npm run lotteryinfo:images

# Phase 3: WordPress投稿
echo "=== Phase 3: WordPress投稿 ==="
npm run lotteryinfo:post

# Phase 4: git push
echo "=== Phase 4: git commit & push ==="
git add output/lottery-info/
git commit -m "chore: RSS抽選パイプライン実行 [skip ci]" || echo "変更なし"
git push
```

## エラーハンドリング

| Phase | 依存 | 失敗時の処理 |
|-------|------|------------|
| 1. rss-lottery-article | output/rss/ にデータがあること | エラー出力して終了 |
| 2. lotteryinfo-images | drafts ファイル | drafts がなければ実質スキップ |
| 3. lotteryinfo-post | imageGenerated: true ファイル | 該当なしならスキップ |
| 4. git push | コミット対象あり | 変更なしならスキップ |

## 完了メッセージ

```
========================================
🎉 RSS抽選パイプライン完了！
========================================

📝 Phase 1: {n}件の記事を生成（RSS由来）
🖼️ Phase 2: {n}件の画像を生成
🚀 Phase 3: {n}件をWordPressに投稿

投稿した記事:
- {タイトル1}: {URL1}
========================================
```

## Claude Code Routines での起動

Claude Code Routines から定期実行する想定:

```
runtime: claude code
schedule: cron("0 10 * * *")  # 毎日10:00 JST
command: claude -p "/rss-lottery-pipeline"
```

※ RSS収集（9:00 JST）の完了を待ってから走らせるため、10:00 JST 以降が推奨。

## 入出力サマリ

| Phase | 入力 | 出力 |
|-------|------|------|
| 1. rss-lottery-article | `output/rss/{date}/*.md` | `output/lottery-info/drafts/{date}/*.md` |
| 2. lotteryinfo-images | `drafts/{date}/*.md` | `images/{date}/*.png` + frontmatter更新 |
| 3. lotteryinfo-post | `drafts/{date}/*.md` + `images/{date}/*.png` | WordPress記事 + frontmatter更新 |

## 環境変数

```env
GEMINI_API_KEY=...
WP_API_URL=...
WP_USER=...
WP_APP_PASSWORD=...
AMAZON_ASSOCIATE_ID=...
RAKUTEN_AFFILIATE_ID=...
YAHOO_CLIENT_ID=...
```

## 部分実行

```bash
# Phase 1のみ
claude "/rss-lottery-article"

# Phase 2-3のみ（drafts が既にある）
npm run lotteryinfo:images
npm run lotteryinfo:post
```
