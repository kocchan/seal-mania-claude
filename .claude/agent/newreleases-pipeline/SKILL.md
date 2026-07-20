# 抽選販売パイプライン（newreleases・統合エージェント）

LivePocket・店舗X（Twitter）から抽選販売情報を収集し、記事生成・画像生成までを行う。

**投稿はこのパイプラインでは行わない**（2026-07-20 整理）:
WordPress投稿は `.github/workflows/post-wordpress.yml` に一本化されている
（`npm run newreleases:post` は Actions が実行）。drafts を push すると
paths トリガーで即投稿され、毎日 10:30 JST の定時実行が保険になる。
役割分担 =「生成はRoutine（Claude）、配信はGitHub Actions」。

## 実行方法

```bash
claude "/newreleases-pipeline"
```

## パイプライン概要

```
[1. newreleases-collect] → [2. newreleases-generate-article] → [3. newreleases:images] → [4. git push]
        ↓                            ↓                                ↓                       ↓
output/new-releases/raw/      .../drafts/{date}/              .../images/{date}/       push→Actionsが投稿
```

## 実行フロー

### Phase 1: 情報収集（newreleases-collect）

```bash
/newreleases-collect
```

LivePocket・店舗X から抽選販売情報を収集し `output/new-releases/raw/{date}/` に保存。

**成功条件:** raw が生成される、または「新着なし」で正常終了
**失敗時:** エラー出力して終了。Phase 2 に進まない。

### Phase 2: 記事生成（newreleases-generate-article）

```bash
/newreleases-generate-article
```

raw データから記事ドラフトを `output/new-releases/drafts/{date}/` に生成。

**成功条件:** drafts が1件以上生成、または該当なしで正常終了
**失敗時:** エラー出力して終了。Phase 3 に進まない。

### Phase 3: 画像生成（newreleases:images）

```bash
npm run newreleases:images
```

Gemini AI でアイキャッチ画像を `output/new-releases/images/{date}/` に生成し、
frontmatter に `imageGenerated: true` を付与。

**成功条件:** すべて生成完了、または該当なしで終了
**失敗時:** エラー出力。画像なしでも Phase 4 に進んでよい。

### Phase 4: git push

```bash
git add output/new-releases/
git commit -m "chore: 抽選販売パイプライン実行 [skip ci]"
git push
```

push を受けて `.github/workflows/post-wordpress.yml` が起動し、WordPress投稿を行う。

## エラーハンドリング

| Phase | 依存 | 失敗時の処理 |
|-------|------|------------|
| 1. collect | LivePocket/X にアクセスできること | エラー出力して終了 |
| 2. generate-article | raw データ | raw がなければ実質スキップ |
| 3. images | drafts ファイル | 失敗しても Phase 4 へ |
| 4. git push | コミット対象あり | 変更なしならスキップ |

## 完了メッセージ

```
========================================
🎉 抽選販売パイプライン完了！
========================================

📥 Phase 1: {n}件の抽選情報を収集
📝 Phase 2: {n}件の記事を生成
🖼️ Phase 3: {n}件の画像を生成
💾 Phase 4: push完了（WordPress投稿は post-wordpress.yml が実行）
========================================
```

## Claude Code Routines での起動

```
runtime: claude code
schedule: cron("0 10 * * *")  # 毎日10:00 JST
指示: /newreleases-pipeline
```

## 環境変数

```env
GEMINI_API_KEY=...
```

※ WordPress・アフィリエイト系の環境変数は投稿を担う GitHub Actions 側でのみ必要。
