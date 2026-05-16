# 新商品情報収集フロー

新商品発売情報を収集し、リッチな記事の下書きを生成する。

## 概要

- **実行タイミング**: 毎日朝 6:00（cron）
- **実行環境**: ローカルMac + Claude Code CLI
- **入力**: 公式X、PR TIMES などの情報源
- **出力**: `output/lottery-info/drafts/` に下書きファイル

## アーキテクチャ図

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: ソース検索                                      │
│                                                         │
│  公式X・PR TIMESから新商品情報を検索                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: ソース取得・保存                                │
│                                                         │
│  WebFetchで全文取得 → raw/ に保存                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: 記事生成                                       │
│                                                         │
│  raw/のソースを読み込み → リッチな記事を生成              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: 保存・通知                                      │
│                                                         │
│  drafts/に保存 → git push → Slack Webhook通知           │
└─────────────────────────────────────────────────────────┘
```

## 情報源

| ソース | 方法 | 取得内容 |
|--------|------|----------|
| 公式X (@bonbon_drop) | WebSearch → WebFetch | 投稿全文、画像URL |
| PR TIMES | WebFetch | プレスリリース全文、画像 |
| 公式ストア (qlia.shop) | WebFetch | 商品ページ全文 |

## ディレクトリ構成

```
output/lottery-info/
├── raw/                          # ソース全文を保存
│   └── 2026-05-01/
│       ├── prtimes-12345.md
│       └── x-bonbon_drop-67890.md
└── drafts/                       # 生成された下書き
    └── 2026-05-01-sanrio-moji.md
```

## Step 1: ソース検索

### 公式X検索

```
WebSearch: "site:x.com bonbon_drop 新商品 OR 発売 OR NEW 2026"
```

### PR TIMES検索

```
WebFetch: https://prtimes.jp/main/action.php?run=search&search=ボンボンドロップシール
```

## Step 2: ソース取得・保存

見つかった情報源のページ全文をWebFetchで取得し、`raw/{date}/` に保存する。

### ソースファイルのフォーマット

`output/lottery-info/raw/2026-05-01/prtimes-12345.md`:

```markdown
---
source: prtimes
sourceId: "12345"
sourceUrl: "https://prtimes.jp/main/html/rd/p/000000123.000012345.html"
fetchedAt: "2026-05-01T03:00:00+09:00"
---

# プレスリリースタイトル

本文の全文がここに入る...

株式会社クーリア（本社：大阪市...）は、「ボンボンドロップシール」シリーズの
新作「サンリオキャラクターズ moji」を2026年5月15日より発売いたします。

### 商品概要

- 商品名：ボンボンドロップシール サンリオキャラクターズ moji
- 価格：550円（税込）
- 種類：全8種
- 発売日：2026年5月15日

### キャラクターラインナップ

1. ハローキティ
2. シナモロール
3. クロミ
...

---

画像URL:
- https://prcdn.freetls.fastly.net/release_image/...
```

## Step 3: 記事生成

Claude CLIが `raw/` のソース全文を読み込み、リッチな記事を生成する。

### 記事の構成（2000〜3000文字目安）

| セクション | 内容 |
|------------|------|
| 導入文 | 読者の興味を引くキャッチーな書き出し |
| 商品詳細 | 基本情報を表形式で整理 |
| キャラクター紹介 | 各キャラの説明付きで紹介 |
| デザインの特徴 | 商品の魅力を深掘り |
| 購入方法・販売店舗 | どこで買えるか |
| まとめ | 発売日を再度強調 |

### 文字数目安

- **最小**: 1500文字
- **推奨**: 2000〜3000文字
- **最大**: 4000文字

## Step 4: 保存・通知

### 下書きファイルのフォーマット

`output/lottery-info/drafts/2026-05-01-sanrio-moji.md`:

```markdown
---
title: "【速報】ボンボンドロップシール「サンリオキャラクターズ moji」が5月15日発売！"
productName: "ボンボンドロップシール サンリオキャラクターズ moji"
series: "サンリオキャラクターズ"
releaseDate: "2026-05-15"
price: "550円（税込）"
types: 8
characters:
  - ハローキティ
  - シナモロール
  - クロミ
stores:
  - ロフト
  - 東急ハンズ
sourceUrl: "https://prtimes.jp/main/html/rd/p/..."
rawFile: "output/lottery-info/raw/2026-05-01/prtimes-12345.md"
approved: false
posted: false
createdAt: "2026-05-01T03:30:00+09:00"
---

## ボンボンドロップシールに待望の新作登場！

ぷっくり立体的な質感が大人気の「ボンボンドロップシール」シリーズに...

（記事本文 2000〜3000文字）

---

*情報元: [PR TIMES](https://prtimes.jp/main/html/rd/p/...)*
```

### フラグの初期値

| フラグ | 初期値 | 意味 |
|--------|--------|------|
| approved | false | 未承認（brush-up-flowで承認） |
| posted | false | 未投稿（post-flowで投稿） |

### Slack Webhook通知

下書き作成後、Slackに通知を送信する。

```json
{
  "text": "📢 新商品記事の下書きを作成しました",
  "attachments": [
    {
      "color": "#36a64f",
      "title": "【速報】サンリオキャラクターズ moji 全8種が5月発売",
      "text": "発売日: 2026-05-15\n価格: 550円（税込）\n種類: 全8種",
      "footer": "Slack for Claudeで「下書き見せて」と話しかけてください"
    }
  ]
}
```

## cron設定

```cron
# 毎日午前6時に新商品情報収集
0 6 * * * cd /path/to/seal-mania-claude && claude -p "/lotteryinfo-collect"
```

## スキル定義

`.claude/skills/lotteryinfo-collect/SKILL.md`

```markdown
# 新商品情報収集スキル

## タスク

### 1. ソース検索

公式X（@bonbon_drop）の最新投稿を検索:
- WebSearchで「site:x.com bonbon_drop 新商品 OR 発売 OR NEW 2026」
- 直近1週間の投稿をチェック

PR TIMESでプレスリリースを検索:
- WebFetchで「ボンボンドロップシール」「クーリア」を検索

### 2. ソース全文の取得・保存

見つかった情報源のページ全文をWebFetchで取得し、
output/lottery-info/raw/{date}/ に保存する。

### 3. 記事生成

raw/に保存したソース全文を読み込み、以下の構成でリッチな記事を生成:
- 導入文（読者の興味を引く）
- 商品詳細（表形式）
- キャラクター紹介（各キャラの説明付き）
- デザインの特徴
- 購入方法・販売店舗
- まとめ

目安: 2000〜3000文字

### 4. 下書き保存

生成した記事を output/lottery-info/drafts/{date}-{slug}.md に保存。

frontmatterに以下を含める:
- title, productName, series, releaseDate, price
- types, characters, stores
- sourceUrl, rawFile
- approved: false, posted: false

### 5. git commit & push

### 6. Slack Webhook通知

下書きのタイトルと概要を通知。
```

## 実行例

```
[Collect] 情報収集開始（06:00）

[Step 1] ソース検索
[Collect] 公式X検索中...
[Collect] 新商品投稿を発見: 1件
[Collect] PR TIMES検索中...
[Collect] プレスリリースを発見: 1件

[Step 2] ソース取得・保存
[Collect] WebFetch: https://prtimes.jp/main/html/rd/p/000000123...
[Collect] 保存: raw/2026-05-01/prtimes-12345.md (3,500文字)

[Step 3] 記事生成
[Collect] ソース読み込み: 1件
[Collect] 記事生成中...
[Collect] 生成完了: 2,450文字

[Step 4] 保存・通知
[Collect] 保存: drafts/2026-05-01-sanrio-moji.md
[Collect] git push完了
[Collect] Slack通知送信

[Collect] 完了
```

## 次のフロー

collect-flow完了後、人間がSlack通知を確認し、**brush-up-flow**（Slack for Claudeでブラッシュアップ）に進む。
