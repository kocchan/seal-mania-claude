# 目撃情報記事生成スキル

収集したツイートをGemini AIで分析し、目撃情報を抽出する。

## 概要

`output/sightings/raw/` の未処理ツイートを分析し、店舗名・住所・在庫状況などを抽出して記事データを生成する。

## 機能

- **AI分析**: Gemini AIでツイートを分析
- **情報抽出**: 店舗名、住所、商品名、在庫状況を抽出
- **バッチ処理**: 20件ずつ処理（API制限対策）
- **重複除外**: 処理済みツイートはスキップ
- **1日1ファイル**: 同じ日に実行すると追記

## 実行方法

```bash
npm run generate:articles
```

または

```bash
node scripts/sightings/generate-articles.js
```

## 必要な設定

- `GEMINI_API_KEY`: Google Gemini APIキー
  - ローカル: `.env` に設定
  - GitHub Actions: Secretsに設定

## 入出力

### 入力

| ファイル | 説明 |
|----------|------|
| `output/sightings/raw/yahoo-{日付}.json` | 収集したツイート（直近3日分） |

### 出力

| ファイル | 説明 |
|----------|------|
| `output/sightings/articles/{日付}.json` | 抽出された目撃情報 |
| `output/sightings/raw/yahoo-{日付}.json` | `isProcessed`フラグを更新 |

## 出力フォーマット

```json
{
  "date": "2026-04-30",
  "updatedAt": "2026-04-30T23:19:00+09:00",
  "count": 5,
  "articles": [
    {
      "isSighting": true,
      "prefecture": "東京都",
      "city": "渋谷区",
      "shopName": "ドン・キホーテ渋谷店",
      "shopAddress": "東京都渋谷区...",
      "productName": "ボンボンドロップシール サンリオ",
      "sightingTime": "2026-04-30 14:00頃",
      "statusText": "在庫あり（残り少）",
      "confidenceMemo": "写真付きで信頼性高い",
      "sourceUrl": "https://x.com/...",
      "sourceTweetId": "123456789",
      "isPrediction": false
    }
  ]
}
```

## 抽出される情報

| フィールド | 説明 |
|------------|------|
| `prefecture` | 都道府県 |
| `city` | 市区町村 |
| `shopName` | 店舗名 |
| `shopAddress` | 住所 |
| `productName` | 商品名 |
| `sightingTime` | 目撃日時 |
| `statusText` | 在庫状況 |
| `confidenceMemo` | 信頼性メモ |
| `isPrediction` | AIが推測した場合はtrue |

## 実行タイミング

- 手動実行
- または `npm run scrape:yahoo` の後に実行
