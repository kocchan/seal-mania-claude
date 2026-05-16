# RSS新作情報パイプライン（統合エージェント）

RSS収集データから新作情報の記事を生成し、git にコミット & プッシュする。

## 実行方法

```bash
claude "/rss-newproduct-pipeline"
```

## パイプライン概要

```
[1. rss-newproduct-article] → [2. git push]
        ↓
output/newproduct/drafts/{date}/
```

※ Phase 0（RSS 収集）は `.github/workflows/rss-scrape.yml` が毎日 9:00 JST に自動実行している。

※ 抽選パイプライン（`/rss-lottery-pipeline`）と異なり、新作情報用の画像生成スキル・WordPress投稿スキルは現状未整備。記事ドラフトの生成までを担う。将来 `npm run newproduct:images` / `npm run newproduct:post` を追加する想定。

## 実行フロー

### Phase 1: 記事生成（rss-newproduct-article）

```bash
/rss-newproduct-article
```

**処理内容:**
- `output/rss/{date}/*.md` を走査
- 新作キーワード（新発売 / 新作 / コラボ / ◯月発売 等）が含まれる記事を抽出
- 抽選キーワードを含むものは除外（`/rss-lottery-article` 側で処理）
- 信頼できる情報源（ニュース・公式）を優先、SNS本文のみのものはスキップ
- 既存ドラフトとの重複チェック（sourceRssUrl）
- `output/newproduct/drafts/{date}/{slug}.md` に記事生成

**成功条件:** drafts が1件以上生成、または「該当なし」で正常終了

**失敗時:** エラー出力して終了。

### Phase 2: git push

```bash
git add output/newproduct/drafts/
git commit -m "chore: RSS新作情報から記事生成 [skip ci]"
git push
```

新規ドラフトをコミット & プッシュ。

## 実行コマンド（一括）

```bash
# Phase 1: 記事生成
echo "=== Phase 1: RSS新作記事生成 ==="
# /rss-newproduct-article を実行

# Phase 2: git push
echo "=== Phase 2: git commit & push ==="
git add output/newproduct/drafts/
git commit -m "chore: RSS新作パイプライン実行 [skip ci]" || echo "変更なし"
git push
```

## エラーハンドリング

| Phase | 依存 | 失敗時の処理 |
|-------|------|------------|
| 1. rss-newproduct-article | output/rss/ にデータがあること | エラー出力して終了 |
| 2. git push | コミット対象あり | 変更なしならスキップ |

## 完了メッセージ

```
========================================
🎉 RSS新作パイプライン完了！
========================================

📝 Phase 1: {n}件の新作記事を生成（RSS由来）

ドラフト保存先: output/newproduct/drafts/{date}/
- {ファイル1}
- {ファイル2}

※ 画像生成・WordPress投稿は現状未整備。手動でWordPressへコピー＆ペーストするか、後続スクリプトの整備をお待ちください。
========================================
```

## Claude Code Routines での起動

Claude Code Routines から定期実行する想定:

```
runtime: claude code
schedule: cron("0 11 * * *")  # 毎日11:00 JST
command: claude -p "/rss-newproduct-pipeline"
```

※ RSS収集（9:00 JST）と抽選パイプライン（10:00 JST想定）の完了を待ってから走らせるため、11:00 JST 以降が推奨。

## 入出力サマリ

| Phase | 入力 | 出力 |
|-------|------|------|
| 1. rss-newproduct-article | `output/rss/{date}/*.md` | `output/newproduct/drafts/{date}/*.md` |
| 2. git push | drafts/ の変更 | リモートmainブランチ |

## 抽選パイプラインとの振り分け

| 条件 | 担当パイプライン |
|------|----------------|
| 抽選販売・応募・LivePocket等を含むRSS記事 | `/rss-lottery-pipeline` |
| 新発売・コラボ・新作のニュース | `/rss-newproduct-pipeline`（このパイプライン） |

両パイプラインを同日に走らせる場合、抽選を先に動かしておくと、抽選キーワードを含むものが先にlottery側で取り込まれ、newproduct側では確実に除外できる。

## 今後の拡張

- `scripts/newproduct/generate-images.js` 追加（Gemini AIで新作向けアイキャッチ生成）
- `scripts/newproduct/post-wordpress.js` 追加（WordPress投稿、新作カテゴリ用）
- `config/newproduct.json` 追加（カテゴリマップ・タグ設定）
- `npm run newproduct:images` / `newproduct:post` を package.json に登録
- 本パイプラインの Phase 2/3 として組み込み
