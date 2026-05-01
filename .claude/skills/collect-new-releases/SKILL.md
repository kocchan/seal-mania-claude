# 新商品情報収集スキル

新商品発売情報を収集し、リッチな記事の下書きを生成する。

## タスク

### 1. ソース検索

公式X（@bonbon_drop）の最新投稿を検索:

```
WebSearchで「site:x.com bonbon_drop 新商品 OR 発売 OR NEW 2026」を検索
```

PR TIMESでプレスリリースを検索:

```
WebFetchで https://prtimes.jp/main/action.php?run=search&search=ボンボンドロップシール
```

### 2. ソース全文の取得・保存

見つかった情報源のページ全文をWebFetchで取得し、`output/new-releases/raw/{date}/` に保存する。

**重要: 画像URLの抽出**

WebFetchで取得したコンテンツから、商品画像のURLを必ず抽出する:

- **X（Twitter）**: 投稿に添付された画像URL（`pbs.twimg.com/media/...`形式）
- **PR TIMES**: 記事内の商品画像URL（`prcdn.freetls.fastly.net/...`や`prtimes.jp/i/...`形式）

画像URLは以下の優先順位で抽出:
1. メイン商品画像（最も大きい/目立つ画像）
2. 商品詳細画像
3. サムネイル画像

ファイル名:
- PR TIMES: `prtimes-{記事ID}.md`
- 公式X: `x-{userId}-{tweetId}.md`

ファイルフォーマット:

```markdown
---
source: prtimes
sourceId: "12345"
sourceUrl: "https://prtimes.jp/..."
fetchedAt: "2026-05-01T06:00:00+09:00"
images:
  - url: "https://prcdn.freetls.fastly.net/release_image/..."
    alt: "商品メイン画像"
  - url: "https://prcdn.freetls.fastly.net/release_image/..."
    alt: "商品詳細画像"
---

（全文）
```

### 3. 記事生成

`raw/` に保存したソース全文を読み込み、以下の構成でリッチな記事を生成する。

**記事構成（2000〜3000文字）:**

1. **導入文** - 読者の興味を引くキャッチーな書き出し
2. **メイン画像** - `![商品画像](featuredImage URL)` を配置
3. **商品詳細** - 基本情報を表形式で整理
4. **キャラクター紹介** - 各キャラの説明付きで紹介（画像があれば挿入）
5. **デザインの特徴** - 商品の魅力を深掘り
6. **購入方法・販売店舗** - どこで買えるか
7. **まとめ** - 発売日を再度強調

**画像の使い方:**
- 記事本文中にMarkdown形式で画像を埋め込む: `![alt text](image URL)`
- 最も魅力的な画像を`featuredImage`としてアイキャッチに設定

### 4. 下書き保存

生成した記事を `output/new-releases/drafts/{date}-{slug}.md` に保存。

frontmatterに以下を含める:

```yaml
---
title: "【速報】..."
productName: "ボンボンドロップシール ..."
series: "サンリオキャラクターズ"
releaseDate: "2026-05-15"
price: "550円（税込）"
types: 8
characters:
  - ハローキティ
  - シナモロール
stores:
  - ロフト
  - 東急ハンズ
images:
  - url: "https://..."
    alt: "商品メイン画像"
  - url: "https://..."
    alt: "キャラクター一覧"
featuredImage: "https://..."  # 記事のアイキャッチに使う画像URL
sourceUrl: "https://..."
rawFile: "output/new-releases/raw/..."
approved: false
posted: false
createdAt: "2026-05-01T06:00:00+09:00"
---
```

### 5. git commit & push

変更をコミットしてプッシュする。

```bash
git add output/new-releases/
git commit -m "chore: 新商品情報を収集 [skip ci]"
git push
```

### 6. Slack Webhook通知

環境変数 `SLACK_WEBHOOK_URL` を使用して通知を送信。

```json
{
  "text": "📢 新商品記事の下書きを作成しました",
  "attachments": [
    {
      "color": "#36a64f",
      "title": "【速報】...",
      "text": "発売日: ...\n価格: ...",
      "footer": "Slack for Claudeで「下書き見せて」と話しかけてください"
    }
  ]
}
```

## 入出力

| 種類 | パス |
|------|------|
| 出力（raw） | `output/new-releases/raw/{date}/` |
| 出力（drafts） | `output/new-releases/drafts/{date}-{slug}.md` |

## 実行タイミング

cron: 毎日 6:00

```cron
0 6 * * * cd /path/to/seal-mania-claude && claude -p "/collect-new-releases"
```

## 参照ドキュメント

`docs/new-releases/collect-flow.md`
