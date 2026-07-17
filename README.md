# seal-mania-claude

ボンボンドロップシールの情報を自動収集・記事生成・WordPress投稿するツール。

## 機能概要

### 1. 目撃情報収集・記事生成

SNS（X/Threads）から目撃情報を収集し、記事を生成する。

### 2. 抽選販売情報パイプライン

抽選販売情報の収集からWordPress投稿までを自動化。

```
/lotteryinfo-pipeline
```

**パイプライン構成:**
```
collect → generate-article → images → post → git push
```

| Phase | スキル | 役割 |
|-------|--------|------|
| 1 | `/lotteryinfo-collect` | LivePocket/店舗Xから情報収集 → raw/ |
| 2 | `/lotteryinfo-generate-article` | raw/ → drafts/に記事生成 |
| 3 | `/lotteryinfo-images` | Gemini AIで画像生成 → images/ |
| 4 | `/lotteryinfo-post` | WordPress REST APIで投稿 |

詳細: [docs/lotteryinfo-architecture.md](docs/lotteryinfo-architecture.md)

### 3. 新作情報 RSS スクレイプ

Google アラート等の RSS フィードから新作情報を日次取得し、記事 URL をスクレイピングして本文・OGP 画像 URL を保存する。GitHub Actions が毎日 9:00 JST に自動実行。

```bash
npm run rss:scrape
```

詳細: [docs/rss/scrape.md](docs/rss/scrape.md)

### 4. RSS → 記事生成パイプライン（Claude Code Routines 用）

RSS で集めた記事を、抽選情報・新作情報の二系統に振り分けて記事を生成する。Claude Code Routines から定期実行する想定。

| エージェント | 役割 | 出力先 |
|-------------|------|--------|
| `/rss-lottery-pipeline` | RSS → 抽選記事生成 → 画像生成 → WordPress投稿 | `output/lottery-info/drafts/` |
| `/rss-newproduct-pipeline` | RSS → 新作記事生成 → git push | `output/newproduct/drafts/` |

個別スキル:

| スキル | 役割 |
|--------|------|
| `/rss-lottery-article` | RSSから抽選情報を選別し記事を生成 |
| `/rss-newproduct-article` | RSSから新作情報を選別し記事を生成 |

## セットアップ

```bash
npm install
npx playwright install chromium
```

### 環境変数

```env
# Gemini API（画像生成）
GEMINI_API_KEY=your-gemini-api-key

# WordPress
WP_API_URL=https://your-site.com/wp-json/wp/v2
WP_USER=your-username
WP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# アフィリエイト
AMAZON_ASSOCIATE_ID=your-tag-22
RAKUTEN_AFFILIATE_ID=your-rakuten-id
YAHOO_CLIENT_ID=your-yahoo-client-id

# Apify（Threads収集）
APIFY_TOKEN=your-apify-token

# RSS スクレイプ（カンマ区切りで複数指定可、Google アラート等）
RSS_FEED_URLS=https://www.google.com/alerts/feeds/XXXX/YYYY
```

## テーマ設定

`config/sightings.json` で目撃情報のテーマを設定:

```json
{
  "theme": {
    "name": "ボンボンドロップシール",
    "keywords": ["ボンボンドロップシール", "ボンドロ"]
  }
}
```

`config/lotteryinfo.json` で抽選販売のカテゴリ・タグを設定:

```json
{
  "wordpress": {
    "categoryMap": {
      "抽選・予約情報": 918,
      "サンリオ": 930,
      "ちいかわ": 933
    }
  }
}
```

## フォルダ構成

```
seal-mania-claude/
├── .claude/
│   ├── agent/
│   │   ├── lotteryinfo-pipeline/         # 抽選販売 統合パイプライン
│   │   ├── rss-lottery-pipeline/         # RSS→抽選記事 統合パイプライン
│   │   └── rss-newproduct-pipeline/      # RSS→新作記事 統合パイプライン
│   └── skills/
│       ├── lotteryinfo-collect/          # 抽選: 情報収集
│       ├── lotteryinfo-generate-article/ # 抽選: 記事生成（LivePocket由来）
│       ├── lotteryinfo-images/           # 抽選: 画像生成
│       ├── lotteryinfo-post/             # 抽選: WordPress投稿
│       ├── rss-lottery-article/          # RSS→抽選記事生成
│       ├── rss-newproduct-article/       # RSS→新作記事生成
│       ├── sightings-collect-x/          # X目撃情報収集
│       ├── sightings-collect-threads/    # Threads目撃情報収集
│       └── sightings-generate-articles/  # 目撃情報記事生成
│
├── scripts/lotteryinfo/
│   ├── generate-images.js                # 画像生成スクリプト
│   └── post-wordpress.js                 # WordPress投稿スクリプト
│
├── scripts/rss/
│   └── scrape.js                         # RSS取得＋本文スクレイピング
│
├── config/
│   ├── sightings.json                    # 目撃情報テーマ設定
│   ├── lotteryinfo.json                  # 抽選販売カテゴリ設定
│   └── rss.json                          # RSS設定
│
├── output/
│   ├── lottery-info/
│   │   ├── raw/{date}/                   # 収集したrawデータ
│   │   ├── drafts/{date}/                # 生成した記事
│   │   └── images/{date}/                # 生成した画像
│   ├── newproduct/
│   │   └── drafts/{date}/                # RSS由来の新作記事ドラフト
│   ├── rss/{date}/                       # RSSから取得した記事
│   └── blog/
│       └── raw/                          # 目撃情報rawデータ
│
└── docs/
    ├── lotteryinfo-architecture.md       # アーキテクチャドキュメント
    └── rss/scrape.md                     # RSS取得ドキュメント
```

## スクリプト

```bash
# 抽選販売
npm run lotteryinfo:images    # 画像生成
npm run lotteryinfo:post      # WordPress投稿

# 新作情報
npm run newproduct:post       # WordPress投稿（output/newproduct/drafts/）

# 新作情報 RSS
npm run rss:scrape            # RSS取得＋スクレイピング

# 目撃情報
npm run scrape:yahoo          # Yahoo経由でX収集
npm run scrape:threads        # Threads収集
npm run generate:articles     # 記事生成
npm run post:wordpress        # WordPress投稿
```

## 自動実行の仕組み

このプロジェクトの自動化は **2つの実行基盤** に分かれている。

- **GitHub Actions** … リポジトリに定義された `.github/workflows/*.yml`。スクレイピング・記事生成・WordPress投稿など、決まった Node.js スクリプト（`npm run ...`）を cron で実行する。設定はすべてこのリポジトリ内にある。
- **Claude Code Routines** … Claude Code をヘッドレス（`claude -p "/スキル名"`）で定期実行する仕組み。判断や記事の文章生成など「LLM に任せたい処理」を担う。スケジュール本体は Claude Code 側（クラウド）で設定されており、リポジトリには各エージェント/スキルの手順（`.claude/agent`・`.claude/skills`）だけが入っている。

両者は「Claude Routine が記事ドラフトを生成 → GitHub Actions が投稿」というように、時間差で連携している。

### 1. GitHub Actions ワークフロー

すべて JST（UTC+9）表記。手動実行（`workflow_dispatch`）も全ワークフローで可能。

| ワークフロー | ファイル | スケジュール | 処理内容 |
|-------------|---------|-------------|----------|
| RSS スクレイプ | `rss-scrape.yml` | 毎日 9:00 | Google アラート等の RSS を取得し、本文HTML・OGP画像URLを `output/rss/{date}/` に保存（`npm run rss:scrape`） |
| 目撃情報パイプライン | `sightings-pipeline.yml` | 毎日 6:00 / 9:00 / 12:00 / 15:00 / 18:00 / 21:00（1日6回） | X（Yahoo検索経由）収集 → Gemini AIで記事生成 → 画像生成 → WordPress投稿 まで一気通貫 |
| 抽選・新作 WordPress投稿 | `post-wordpress.yml` | 毎日 10:30 ＋ 対象ドラフトの push 時 | ①Claude Routine が作った `claude/*` PR を main に自動マージ → ②抽選・新作・新作販売のドラフトを WordPress へ投稿（`lotteryinfo:post` / `newproduct:post` / `newreleases:post`） |
| 週間目撃まとめ | `weekly-roundup.yml` | 毎週土曜 10:00 | 平日分の目撃情報を県別に集約 → 記事md生成 → 画像生成 → 固定slugで既存記事を上書き投稿 → 個別記事への内部リンク挿入 |

各ワークフローは処理後、生成物や `posted` フラグを `[skip ci]` 付きで自動コミット & プッシュする（これが `chore: 目撃情報データ更新` 等の履歴）。

### 2. Claude Code Routines（Claude が判断・生成する処理）

`claude -p "/スキル名"` をスケジュール実行する。RSS で集めた記事を、抽選 / 新作の二系統に振り分けて記事ドラフトを生成する。**スケジュールは Claude Code 側で設定**（下表は各エージェント定義が推奨する時刻）。

| Routine | 推奨スケジュール | コマンド | 役割 |
|---------|---------------|----------|------|
| RSS→抽選記事 | 毎日 10:00 | `claude -p "/rss-lottery-pipeline"` | RSS抽選記事生成 → 画像生成 → WordPress投稿 → git push |
| RSS→新作記事 | 毎日 11:00 | `claude -p "/rss-newproduct-pipeline"` | RSS新作記事生成 → git push（画像/投稿は現状未整備） |
| 抽選（LivePocket由来） | 任意 | `claude -p "/lotteryinfo-pipeline"` | LivePocket/店舗Xから収集 → 記事 → 画像 → 投稿の一括実行 |

パイプライン（エージェント）は、内部で個別スキルを順番に呼び出す。

| スキル | 役割 |
|--------|------|
| `/lotteryinfo-collect` | LivePocket/店舗Xから抽選情報を収集 |
| `/lotteryinfo-generate-article` | raw → WordPress用記事ドラフト生成 |
| `/lotteryinfo-images` | Gemini AIでアイキャッチ画像生成 |
| `/lotteryinfo-post` | WordPress REST APIで投稿 |
| `/rss-lottery-article` | RSSから抽選情報を選別し記事生成 |
| `/rss-newproduct-article` | RSSから新作情報を選別し記事生成 |
| `/sightings-collect-x` / `/sightings-collect-threads` | SNSから目撃情報を収集 |
| `/sightings-generate-articles` | 目撃情報の記事生成 |
| `/competitor-analyze` | 競合サイト分析 |
| `/general-update-readme` | README 更新 |

### 3. 1日の実行タイムライン（JST）

```
06:00  目撃情報パイプライン（GitHub Actions）
09:00  RSSスクレイプ（GitHub Actions） ＋ 目撃情報パイプライン
10:00  RSS→抽選記事（Claude Routine）  … claude/* ブランチにPRを作成
10:30  抽選・新作WP投稿（GitHub Actions）… 上のPRをマージ → WordPress投稿
11:00  RSS→新作記事（Claude Routine）
12:00  目撃情報パイプライン（GitHub Actions）
15:00  目撃情報パイプライン（GitHub Actions）
18:00  目撃情報パイプライン（GitHub Actions）
21:00  目撃情報パイプライン（GitHub Actions）

土10:00  週間目撃まとめ（GitHub Actions）
```

RSSスクレイプ（9:00）→ RSS抽選記事生成（10:00）→ WP投稿ワークフロー（10:30）の順に走らせることで、「収集 → Claude が記事化 → 投稿」がリレー方式で成立する。各時刻は前段の完了を待つよう 30分〜1時間ずらしてある。

### 4. Claude Code hook（settings.json）

`.claude/settings.json` に `PostToolUse` hook を定義しており、Claude Code で Write/Edit を行った直後に「この変更で README 更新が必要か」を確認するプロンプトが自動で挿入される。手動編集時のドキュメント追従漏れを防ぐための仕組み。

### 手動 / ローカル実行

```cron
# 抽選販売パイプライン (LivePocket由来) をローカル cron で回す例
0 7,13,19 * * * cd /path/to/seal-mania-claude && claude -p "/lotteryinfo-pipeline"

# 目撃情報収集のみローカルで回す例
0 6,12,18 * * * cd /path/to/seal-mania-claude && npm run scrape:all
```
