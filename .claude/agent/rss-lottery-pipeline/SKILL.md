# RSS抽選情報パイプライン（統合エージェント）

RSS収集データから抽選情報の記事を作り、画像生成までを行う。

**投稿はこのパイプラインでは行わない**（2026-07-20 整理）:
WordPress投稿は `.github/workflows/post-wordpress.yml` に一本化されている。
drafts を push すると paths トリガーで即投稿され、毎日 10:30 JST の定時実行が保険になる。
役割分担 =「生成はRoutine（Claude）、配信はGitHub Actions」。

## 実行方法

```bash
claude "/rss-lottery-pipeline"
```

## パイプライン概要

```
[1. rss-lottery-article] → [2. lotteryinfo-images] → [3. git push]
        ↓                          ↓                      ↓
output/lottery-info/drafts/   .../images/{date}/    push→Actionsが投稿
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

**失敗時:** エラー出力。画像なしでも Phase 3 に進んでよい（投稿側は画像必須）。

### Phase 3: git push

```bash
git add output/lottery-info/
git commit -m "chore: RSS抽選パイプライン実行 [skip ci]"
git push
```

新規ドラフト・画像をコミット & プッシュ。
push を受けて `.github/workflows/post-wordpress.yml` が起動し、WordPress投稿を行う。

## 実行コマンド（一括）

```bash
# Phase 1: 記事生成
echo "=== Phase 1: RSS抽選記事生成 ==="
# /rss-lottery-article を実行

# Phase 2: 画像生成
echo "=== Phase 2: 画像生成 ==="
npm run lotteryinfo:images

# Phase 3: git push
echo "=== Phase 3: git commit & push ==="
git add output/lottery-info/
git commit -m "chore: RSS抽選パイプライン実行 [skip ci]" || echo "変更なし"
git push
```

## エラーハンドリング

| Phase | 依存 | 失敗時の処理 |
|-------|------|------------|
| 1. rss-lottery-article | output/rss/ にデータがあること | エラー出力して終了 |
| 2. lotteryinfo-images | drafts ファイル | drafts がなければ実質スキップ |
| 3. git push | コミット対象あり | 変更なしならスキップ |

## 完了メッセージ

```
========================================
🎉 RSS抽選パイプライン完了！
========================================

📝 Phase 1: {n}件の記事を生成（RSS由来）
🖼️ Phase 2: {n}件の画像を生成
💾 Phase 3: push完了（WordPress投稿は post-wordpress.yml が実行）
========================================
```

## Claude Code Routines での起動

Claude Code Routines から定期実行する想定:

```
runtime: claude code
schedule: cron("30 9 * * *")  # 毎日9:30 JST
command: claude -p "/rss-lottery-pipeline"
```

※ RSS収集（9:00 JST）の完了を待ってから走らせる。

## 入出力サマリ

| Phase | 入力 | 出力 |
|-------|------|------|
| 1. rss-lottery-article | `output/rss/{date}/*.md` | `output/lottery-info/drafts/{date}/*.md` |
| 2. lotteryinfo-images | `drafts/{date}/*.md` | `images/{date}/*.png` + frontmatter更新 |
| 3. git push | drafts + images | GitHub main（→Actionsが投稿） |

## 環境変数

```env
GEMINI_API_KEY=...
```

※ WordPress・アフィリエイト系の環境変数は投稿を担う GitHub Actions 側でのみ必要。

## 部分実行

```bash
# Phase 1のみ
claude "/rss-lottery-article"

# Phase 2のみ（drafts が既にある）
npm run lotteryinfo:images
```
