# 新商品記事投稿スキル

承認済み（approved: true）の下書きをWordPressに投稿する。

## タスク

### 1. 下書き検出

`output/new-releases/drafts/` から以下の条件を満たす下書きを検出:

- `approved: true`
- `posted: false`

### 2. 記事変換

各下書きについて:

**Markdown → HTML変換:**

```markdown
## ボンボンドロップシールに待望の新作登場！
```
↓
```html
<h2>ボンボンドロップシールに待望の新作登場！</h2>
```

**アフィリエイトリンク挿入:**

frontmatterの `series` を使用してリンクを生成:

```html
<div class="affiliate-box">
  <h4>🛒 オンラインで探す</h4>
  <ul>
    <li><a href="https://www.amazon.co.jp/s?k=ボンボンドロップシール+{series}&tag={AMAZON_ASSOCIATE_ID}">Amazonで探す</a></li>
    <li><a href="https://search.rakuten.co.jp/search/mall/ボンボンドロップシール+{series}/">楽天市場で探す</a></li>
    <li><a href="https://shopping.yahoo.co.jp/search?p=ボンボンドロップシール+{series}">Yahoo!ショッピングで探す</a></li>
  </ul>
</div>
```

### 3. WordPress投稿

WordPress REST APIで投稿する。

環境変数:
- `WP_API_URL`
- `WP_USER`
- `WP_APP_PASSWORD`

リクエスト:

```json
{
  "title": "【速報】...",
  "content": "<h2>...</h2>...",
  "status": "publish",
  "categories": [新商品情報カテゴリID],
  "tags": ["サンリオ", "新商品", "ボンボンドロップシール"]
}
```

### 4. フラグ更新

投稿成功後、下書きファイルを更新:

```yaml
approved: true
posted: true
wpPostId: 12345
wpPostUrl: "https://your-site.com/..."
postedAt: "2026-05-01T17:00:00+09:00"
```

### 5. git commit & push

```bash
git add output/new-releases/drafts/
git commit -m "chore: 新商品記事を投稿 [skip ci]"
git push
```

### 6. Slack通知

投稿完了をSlack Webhookで通知:

```json
{
  "text": "✅ 新商品記事を投稿しました",
  "attachments": [
    {
      "color": "#36a64f",
      "title": "【速報】...",
      "title_link": "https://your-site.com/...",
      "text": "WordPress投稿ID: 12345"
    }
  ]
}
```

エラー時:

```json
{
  "text": "❌ 新商品記事の投稿に失敗しました",
  "attachments": [
    {
      "color": "#ff0000",
      "title": "エラー: ...",
      "text": "ファイル: ...\nエラー: ..."
    }
  ]
}
```

## 環境変数

```
WP_API_URL=https://your-wordpress-site.com/wp-json/wp/v2
WP_USER=username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
WP_CATEGORY_NEW_RELEASES=123
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

## 入出力

| 種類 | パス |
|------|------|
| 入力 | `output/new-releases/drafts/*.md` (approved: true, posted: false) |
| 出力 | `output/new-releases/drafts/*.md` (posted: true) |
| 出力 | WordPress記事 |

## 実行タイミング

cron: 毎日 17:00

```cron
0 17 * * * cd /path/to/seal-mania-claude && claude -p "/newreleases-post"
```

## 参照ドキュメント

`docs/new-releases/post-flow.md`
