# RSSめじるしアクセサリー新作パイプライン（統合エージェント）

RSS収集データからめじるしアクセサリー（目印チャーム）新作の記事を生成し、git にコミット & プッシュする。
（`rss-newproduct-pipeline` の複製・めじるし向け版）

## 実行方法

```bash
claude "/rss-mejirushi-pipeline"
```

## パイプライン概要

```
[1. rss-mejirushi-article] → [2. git push]
        ↓
output/mejirushi/drafts/{date}/
```

※ Phase 0（RSS 収集）は `.github/workflows/rss-scrape.yml` が毎日 9:00 JST に自動実行している（フィルタキーワードにめじるし系を含む）。

※ WordPress 投稿は `.github/workflows/post-wordpress.yml`（毎日 10:30 JST）の `npm run mejirushi:post` が自動実行。カテゴリ（めじるしアクセサリー/新作・ガチャ情報）はテーマの functions.php が初回アクセス時に自動作成する。

※ 抽選パイプラインはめじるしでは運用しない（2026-07-19 決定：新作情報のみ）。

## 実行フロー

### Phase 1: 記事生成（rss-mejirushi-article）

```bash
/rss-mejirushi-article
```

**処理内容:**
- `output/rss/{date}/*.md` を走査
- めじるしキーワード（めじるしアクセサリー / めじるしチャーム / 目印チャーム）×新作キーワードの両方を含む記事を抽出
- シールが主題のもの・抽選系は除外（それぞれ既存パイプライン側）
- 信頼できる情報源（ニュース・公式・プレスリリース）を優先
- 既存ドラフトとの重複チェック（sourceRssUrl）
- `output/mejirushi/drafts/{date}/{slug}.md` に記事生成

**成功条件:** drafts が1件以上生成、または「該当なし」で正常終了

**失敗時:** エラー出力して終了。

### Phase 2: git push

```bash
git add output/mejirushi/drafts/
git commit -m "chore: RSSめじるし新作情報から記事生成 [skip ci]"
git push
```

## エラーハンドリング

| Phase | 前提条件 | 失敗時 |
|-------|---------|--------|
| 1. rss-mejirushi-article | output/rss/ にデータがあること | エラー出力して終了 |
| 2. git push | 新規ドラフトがあること | 変更なしなら正常終了 |

## 入出力サマリ

| Phase | 入力 | 出力 |
|-------|------|------|
| 1. rss-mejirushi-article | `output/rss/{date}/*.md` | `output/mejirushi/drafts/{date}/*.md` |
| 2. git push | drafts | GitHub main ブランチ |
