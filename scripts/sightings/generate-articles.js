/**
 * 目撃情報から記事を生成する
 *
 * 使い方:
 *   GEMINI_API_KEY=xxx node scripts/generate-articles.js
 *
 * 入力:
 *   output/sightings/raw/yahoo-{日付}.json
 *
 * 出力:
 *   output/sightings/articles/{日付}.json
 *
 * 機能:
 *   - Gemini AIで目撃情報を分析
 *   - 店舗名・住所・在庫状況を抽出
 *   - 処理済みツイートはスキップ（isProcessedフラグで管理）
 */

import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { config, getNowJST } from './utils.js';

const CONFIG = {
  model: 'gemini-2.5-flash-preview-05-20',
  batchSize: 20,
  rawDir: config.output?.rawDir || 'output/sightings/raw',
  articlesDir: 'output/sightings/articles'
};

// =====================================
// Gemini 記事分析クラス
// =====================================
class ArticleAnalyzer {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: CONFIG.model,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });
  }

  generatePrompt(tweets, referenceDate) {
    const tweetData = tweets.map(t => ({
      id: t.tweetId,
      text: t.text,
      url: t.url,
      time: t.time
    }));

    return `
あなたは「ボンボンドロップシール」の在庫・目撃情報を収集するリポーターAIです。
以下のツイートリストを分析し、**具体的な店舗名が含まれる有効な目撃情報のみ**を抽出してください。

### 重要な指示
1. **住所の特定**: 抽出した「店舗名」とツイート内の「地域情報」から、具体的な住所を特定して 'shopAddress' に入力してください。
2. **フィルタリング**: 「どこにもない」「欲しい」等のツイートは除外し、実際に店舗で「見た」「買った」「入荷していた」という情報だけを抽出してください。
3. **都道府県・市区町村**: 住所から 'prefecture' と 'city' を埋めてください。特定できない場合は isSighting を false にしてください。
4. **日時**: ツイートの 'time' を考慮し、目撃された日時を 'sightingTime' に記述してください（基準日: ${referenceDate}）。
5. **商品名**: ツイート内容から商品名を抽出してください。
6. **在庫状況**: 在庫状況を 'statusText' に要約してください（例: 在庫あり、残り少、完売など）。
7. **信頼性**: 不確定な情報の場合は 'isPrediction' を true にしてください。

### 出力形式（JSON配列）
[
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

### 対象ツイートデータ
${JSON.stringify(tweetData, null, 2)}
`;
  }

  async analyzeBatch(batch, referenceDate) {
    const prompt = this.generatePrompt(batch, referenceDate);
    const result = await this.model.generateContent(prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('[Gemini] JSON解析エラー:', e.message);
      console.error('[Gemini] レスポンス:', text.substring(0, 500));
      return [];
    }
  }
}

// =====================================
// ファイル管理
// =====================================

/**
 * rawファイルから未処理ツイートを取得
 * @returns {{ tweets: Array, fileMap: Map<string, object> }}
 */
function fetchUnprocessedTweets() {
  const tweets = [];
  const fileMap = new Map(); // filepath -> data

  if (!fs.existsSync(CONFIG.rawDir)) {
    return { tweets, fileMap };
  }

  const files = fs.readdirSync(CONFIG.rawDir)
    .filter(f => f.startsWith('yahoo-') && f.endsWith('.json'))
    .sort()
    .reverse();

  // 直近3日分のファイルを対象
  for (const file of files.slice(0, 3)) {
    const filepath = path.join(CONFIG.rawDir, file);
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      fileMap.set(filepath, data);

      for (const tweet of data.data || []) {
        if (!tweet.isProcessed) {
          tweet._filepath = filepath; // どのファイルのツイートか記録
          tweets.push(tweet);
        }
      }
    } catch (e) {
      console.warn(`[Warning] ${file} の読み込みエラー:`, e.message);
    }
  }

  return { tweets, fileMap };
}

/**
 * 処理済みフラグを更新してrawファイルを保存
 */
function markTweetsAsProcessed(processedTweetIds, fileMap) {
  for (const [filepath, data] of fileMap) {
    let updated = false;

    for (const tweet of data.data || []) {
      if (processedTweetIds.has(tweet.tweetId) && !tweet.isProcessed) {
        tweet.isProcessed = true;
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`[Articles] 更新: ${filepath}`);
    }
  }
}

/**
 * 記事を保存
 */
function saveArticles(articles, referenceDate) {
  if (articles.length === 0) return;

  fs.mkdirSync(CONFIG.articlesDir, { recursive: true });

  const filename = `${referenceDate}.json`;
  const filepath = path.join(CONFIG.articlesDir, filename);

  // 既存データとマージ
  let existingArticles = [];
  if (fs.existsSync(filepath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      existingArticles = data.articles || [];
    } catch {
      // ignore
    }
  }

  // 重複除外（sourceUrlで判定）
  const existingUrls = new Set(existingArticles.map(a => a.sourceUrl));
  const newArticles = articles.filter(a => !existingUrls.has(a.sourceUrl));

  const allArticles = [...existingArticles, ...newArticles];

  const result = {
    date: referenceDate,
    updatedAt: getNowJST(),
    count: allArticles.length,
    articles: allArticles
  };

  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
  console.log(`[Articles] 保存: ${filepath} (新規: ${newArticles.length}件, 合計: ${allArticles.length}件)`);
}

// =====================================
// メイン処理
// =====================================
async function main() {
  console.log('[Articles] 記事生成開始');

  const { tweets, fileMap } = fetchUnprocessedTweets();
  console.log(`[Articles] 未処理ツイート: ${tweets.length}件`);

  if (tweets.length === 0) {
    console.log('[Articles] 処理対象なし');
    return;
  }

  const analyzer = new ArticleAnalyzer();
  const referenceDate = new Date().toISOString().split('T')[0];
  const allSightings = [];
  const processedTweetIds = new Set();

  // バッチ処理
  for (let i = 0; i < tweets.length; i += CONFIG.batchSize) {
    const batch = tweets.slice(i, i + CONFIG.batchSize);
    console.log(`[Articles] バッチ ${Math.floor(i / CONFIG.batchSize) + 1}: ${batch.length}件を分析中...`);

    try {
      const sightings = await analyzer.analyzeBatch(batch, referenceDate);
      const validSightings = sightings.filter(s => s.isSighting && s.prefecture && s.city);

      console.log(`[Articles] 有効な目撃情報: ${validSightings.length}件`);
      allSightings.push(...validSightings);

      // 処理済みに追加
      batch.forEach(t => processedTweetIds.add(t.tweetId));

      // API制限対策で待機
      if (i + CONFIG.batchSize < tweets.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (e) {
      console.error('[Articles] バッチ処理エラー:', e.message);
    }
  }

  // 記事を保存
  saveArticles(allSightings, referenceDate);

  // rawファイルの処理済みフラグを更新
  markTweetsAsProcessed(processedTweetIds, fileMap);

  console.log(`[Articles] 完了: ${processedTweetIds.size}件処理, ${allSightings.length}件の目撃情報を抽出`);
}

main().catch(console.error);
