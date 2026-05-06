# WordPress投稿フロー

承認済み（approved: true）の下書きを定期実行でWordPressに投稿する。

## 概要

- **実行タイミング**: 毎日 17:00（cron）
- **実行環境**: ローカルMac + Claude Code CLI
- **入力**: `output/new-releases/drafts/` の下書き（approved: true, posted: false）
- **出力**: WordPressに投稿、下書きファイルを posted: true に更新

## 前提

brush-up-flowが完了し、下書きが approved: true になっている状態。

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: 下書き検出                                      │
│                                                         │
│  drafts/ から approved: true, posted: false を検出      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: 記事変換                                       │
│                                                         │
│  Markdown → HTML変換、アフィリエイトリンク挿入           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: WordPress投稿                                  │
│                                                         │
│  WordPress REST APIで投稿                               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: フラグ更新・通知                               │
│                                                         │
│  posted: true に更新 → git push → Slack通知            │
└─────────────────────────────────────────────────────────┘
```

## Step 1: 下書き検出

`drafts/` から投稿対象の下書きを検出する。

### 検出条件

| 条件 | 値 |
|------|-----|
| approved | true |
| posted | false |

### 例

```
output/new-releases/drafts/
├── 2026-05-01-sanrio-moji.md     # approved: true, posted: false → 投稿対象
├── 2026-04-28-wagara-vol2.md     # approved: true, posted: true  → スキップ
└── 2026-05-02-chiikawa-new.md    # approved: false               → スキップ
```

## Step 2: 記事変換

### Markdown → HTML変換

```markdown
## ボンボンドロップシールに待望の新作登場！

ぷっくり立体的な質感が大人気の...
```

↓

```html
<h2>ボンボンドロップシールに待望の新作登場！</h2>

<p>ぷっくり立体的な質感が大人気の...</p>
```

### アフィリエイトリンク挿入

記事内の適切な位置に挿入。

```html
<div class="affiliate-box">
  <h4>🛒 オンラインで探す</h4>
  <ul>
    <li><a href="https://www.amazon.co.jp/s?k=ボンボンドロップシール+サンリオ&tag=xxx-22">Amazonで探す</a></li>
    <li><a href="https://search.rakuten.co.jp/search/mall/ボンボンドロップシール+サンリオ/">楽天市場で探す</a></li>
    <li><a href="https://shopping.yahoo.co.jp/search?p=ボンボンドロップシール+サンリオ">Yahoo!ショッピングで探す</a></li>
  </ul>
</div>
```

## Step 3: WordPress投稿

WordPress REST APIで投稿する。

### リクエスト

```json
{
  "title": "【速報】ボンボンドロップシール「サンリオキャラクターズ moji」が5月15日発売！",
  "content": "<h2>ボンボンドロップシールに待望の新作登場！</h2>...",
  "status": "publish",
  "categories": [新商品情報カテゴリID],
  "tags": ["サンリオ", "新商品", "ボンボンドロップシール"]
}
```

### レスポンス

```json
{
  "id": 12345,
  "link": "https://your-site.com/new-releases/sanrio-moji-2026/"
}
```

## Step 4: フラグ更新・通知

### フラグ更新

投稿成功後、下書きファイルを更新する。

```yaml
# 更新前
approved: true
posted: false

# 更新後
approved: true
posted: true
wpPostId: 12345
wpPostUrl: "https://your-site.com/new-releases/sanrio-moji-2026/"
postedAt: "2026-05-01T09:00:00+09:00"
```

### Slack通知

投稿完了をSlack Webhookで通知。

```json
{
  "text": "✅ 新商品記事を投稿しました",
  "attachments": [
    {
      "color": "#36a64f",
      "title": "【速報】サンリオキャラクターズ moji 全8種が5月発売",
      "title_link": "https://your-site.com/new-releases/sanrio-moji-2026/",
      "text": "WordPress投稿ID: 12345"
    }
  ]
}
```

## cron設定

```cron
# 毎日17時に投稿処理
0 17 * * * cd /path/to/seal-mania-claude && claude -p "/newreleases-post"
```

## スキル定義

`.claude/skills/newreleases-post/SKILL.md`

```markdown
# 新商品記事投稿スキル

## タスク

1. output/new-releases/drafts/ を読み込む

2. 以下の条件を満たす下書きを検出:
   - approved: true
   - posted: false

3. 各下書きについて:
   - MarkdownをHTMLに変換
   - アフィリエイトリンクを挿入
   - WordPress REST APIで投稿
   - カテゴリ: 新商品情報

4. 投稿成功後:
   - posted: true に更新
   - wpPostId, wpPostUrl, postedAt を記録
   - git commit & push

5. Slack Webhookで結果を通知
```

## 環境変数

```
# WordPress
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_USER=username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
WP_CATEGORY_NEW_RELEASES=123

# アフィリエイト
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id

# 通知
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 実行例

```
[Post] 投稿処理開始（17:00）

[Step 1] 下書き検出
[Post] 検出: 3件
[Post]   - sanrio-moji.md (approved: true, posted: false) → 投稿対象
[Post]   - wagara-vol2.md (posted: true) → スキップ
[Post]   - chiikawa-new.md (approved: false) → スキップ
[Post] 投稿対象: 1件

[Step 2] 記事変換
[Post] Markdown→HTML変換
[Post] アフィリエイトリンク挿入

[Step 3] WordPress投稿
[Post] 投稿中...
[Post] ✅ 投稿完了: ID 12345
[Post] URL: https://your-site.com/new-releases/sanrio-moji-2026/

[Step 4] フラグ更新・通知
[Post] posted: true に更新
[Post] git push完了
[Post] Slack通知送信

[Post] 完了: 1件投稿
```

## エラーハンドリング

| エラー | 対処 |
|--------|------|
| WordPress API接続失敗 | リトライ後、エラー通知 |
| 認証エラー | 処理停止、エラー通知 |
| カテゴリ不明 | デフォルトカテゴリで投稿 |

エラー時もSlack通知:

```json
{
  "text": "❌ 新商品記事の投稿に失敗しました",
  "attachments": [
    {
      "color": "#ff0000",
      "title": "エラー: WordPress API接続失敗",
      "text": "ファイル: 2026-05-01-sanrio-moji.md\nエラー: 401 Unauthorized"
    }
  ]
}
```

## 全体フローとの関係

```
collect-flow（朝6:00）
    │
    └─ ソース収集 → 記事生成 → drafts/保存
                                    │
                                    ▼
                            approved: false
                                    │
brush-up-flow（随時）
    │
    └─ Slack for Claudeでブラッシュアップ → approved: true
                                    │
                                    ▼
                            approved: true
                                    │
post-flow（毎日17:00）← このフロー
    │
    └─ WordPress投稿 → posted: true
                                    │
                                    ▼
                             posted: true
```
