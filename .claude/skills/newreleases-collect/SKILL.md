# 新商品・抽選情報収集スキル

受付中の抽選販売情報を収集し、rawデータとして保存する。

**このスキルの役割**: 情報収集 → `output/new-releases/raw/` に保存まで

**記事生成は別スキル**: `/newreleases-generate-article` で実行

## 実行方法

```bash
claude "/newreleases-collect"
```

## 情報取得元

| 情報 | 取得元 | 取得方法 |
|------|--------|----------|
| 抽選販売 | LivePocket | `livepocket.jp/e/{id}` スクレイピング |
| イベント告知 | 店舗公式X | @LOFT_Official / @kiddyland_info / @partyrico_jp |
| 新商品 | エポック社 | epoch.jp 新着情報 |
| 商品画像 | 公式サイト / X添付画像 | WebFetchで取得 |

## タスク

### 0. 現在時刻の確認（必須）

**スキル実行時に必ず最初に行うこと:**

```bash
date "+%Y-%m-%d %H:%M:%S %Z"
```

取得した現在時刻を基準に、**申込締切が現在時刻より後のもの（受付中）のみ**を処理対象とする。

#### フィルタリングルール

| 条件 | 処理 |
|------|------|
| 申込締切 > 現在時刻 | **処理対象** (受付中) |
| 申込締切 <= 現在時刻 | **スキップ** (締切済み) |

### 0.5 重複チェック（必須）

**新規rawデータを保存する前に、必ず既存データとの重複を確認する:**

```bash
# 既存のeventId/eventUrlを取得
grep -h "eventId\|eventUrl" output/new-releases/raw/*/*.md 2>/dev/null
```

#### 重複判定ルール

| 条件 | 処理 |
|------|------|
| 同じ eventId が存在 | **スキップ**（既に取得済み） |
| 同じ eventUrl が存在 | **スキップ**（既に取得済み） |
| 新規 eventId/eventUrl | **処理対象** |

重複している場合は「既に取得済み: {eventId}」と表示してスキップする。

### 1. LivePocketから抽選情報を収集

#### 1.1 イベント検索

```
WebSearchで「ボンボンドロップ 抽選 受付中 {現在の月}月」
WebSearchで「livepocket ボンボンドロップ 締切 {現在の月+1}月」
```

**注意**: `site:livepocket.jp` は検索結果が出にくいため、情報サイト経由で検索する

#### 1.2 イベント詳細ページから取得する情報

WebFetchで `https://livepocket.jp/e/{eventId}` を取得し、以下を抽出:

| 項目 | 取得内容 |
|------|----------|
| イベント名 | 正式タイトル |
| サムネイル画像 | OGP画像 or イベント画像URL |
| 申込開始 | 日時（YYYY-MM-DD HH:MM） |
| 申込締切 | 日時（YYYY-MM-DD HH:MM） |
| 当選発表 | 日時 |
| 販売日 | 日付 |
| 販売時間 | 開始〜終了（例: 13:30〜16:25） |
| 時間帯指定 | あり/なし、何分交代制か |
| 店舗名 | 正式名称 |
| 店舗階数 | 例: 12階文具売場 |
| 対象商品 | 商品名リスト |
| 商品価格 | 各商品の価格 |
| 購入制限 | 1人何点まで |
| 本人確認 | 顔写真付き身分証必須か |
| 同伴者 | 可/不可 |
| 代理購入 | 可/不可 |
| フリー販売 | あり/なし |
| 注意事項 | 全文 |

#### 1.3 画像取得

LivePocketページから以下の画像URLを抽出:
- イベントサムネイル（OGP画像）
- 商品画像（あれば）
- 店舗告知画像（あれば）

### 2. 店舗公式Xから告知を収集

```
WebSearchで以下を検索:
- 「site:x.com LOFT_Official ボンボンドロップ OR 抽選 2026」
- 「site:x.com kiddyland_info ボンボンドロップ OR シール 2026」
```

取得する情報:
- ツイート本文
- 添付画像URL（`pbs.twimg.com/media/...`）
- ツイートURL

### 3. 店舗情報を補完

Google Places APIまたはWebSearchで:
- 正式住所
- 営業時間
- 最寄り駅

### 4. rawデータの保存

出力先: `output/new-releases/raw/{date}/`

ファイル名: `{店舗名slug}-{商品カテゴリ}.md`

例: `partyrico-fujimi-chiikawa.md`

#### rawデータのフォーマット

```markdown
---
source: livepocket
eventId: "6jwt4"
eventUrl: "https://livepocket.jp/e/6jwt4"
fetchedAt: "2026-05-06T14:45:00+09:00"
deadline: "2026-05-06T23:59:00+09:00"
status: "受付中"
images:
  - url: "https://livepocket.jp/public/..."
    type: "thumbnail"
  - url: "https://pbs.twimg.com/media/..."
    type: "product"
---

# イベント名

## イベント概要

- **イベント名**:
- **主催**:
- **販売日**:
- **営業時間**:

## 申込情報

- **申込期間**:
- **当選発表**:
- **申込URL**:

## 対象商品

| 商品名 | 価格 |
|--------|------|
| ... | ... |

## 購入制限

- ...

## 本人確認

- ...

## 注意事項

- ...

## 情報ソース

- LivePocket: https://...
- 参考サイト: https://...
```

### 5. git commit & push

```bash
git add output/new-releases/raw/
git commit -m "chore: 新商品・抽選情報を収集 [skip ci]"
git push
```

### 6. 次のステップを案内

収集完了後、以下を表示:

```
✅ 収集完了: {件数}件のrawデータを保存しました

保存先: output/new-releases/raw/{date}/
- {ファイル1}
- {ファイル2}

👉 記事を生成するには以下を実行:
   claude "/newreleases-generate-article"
```

## 入出力

| 種類 | パス |
|------|------|
| 出力 | `output/new-releases/raw/{date}/` |

## 実行タイミング

cron: 毎日 6:00 / 12:00 / 18:00

```cron
0 6,12,18 * * * cd /path/to/seal-mania-claude && claude -p "/newreleases-collect"
```

## 競合との差別化

| 項目 | 競合 | 自社 |
|------|------|------|
| 情報源 | LivePocket転載 | LivePocket + 店舗X |
| 更新頻度 | 1-2日 | 1日3回 |
| 画像 | 公式のみ | 公式 + X添付画像 |
| 店舗情報 | 名前のみ | 住所・地図・最寄り駅 |
