/**
 * Apify経由でThreadsの投稿を取得する
 *
 * 使い方:
 *   APIFY_TOKEN=xxx node scripts/scrape-threads.js [検索キーワード]
 *
 * 出力:
 *   output/blog/raw/threads-{timestamp}.json
 *
 * 必要:
 *   - Apifyアカウント（無料枠: $5/月）
 *   - APIFY_TOKEN環境変数
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// configからテーマを読み込む
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const DEFAULT_QUERY = config.theme.name;
const OUTPUT_DIR = 'output/blog/raw';
const APIFY_TOKEN = process.env.APIFY_TOKEN;

async function scrapeThreads(query = DEFAULT_QUERY) {
  if (!APIFY_TOKEN) {
    console.error('[Threads] Error: APIFY_TOKEN is not set');
    console.log('[Threads] Set APIFY_TOKEN in .env or GitHub Secrets');
    process.exit(1);
  }

  try {
    const actorId = 'apify/threads-scraper';
    const input = {
      searchQueries: [query],
      maxPosts: 20,
      resultsType: 'posts'
    };

    console.log(`[Threads] Starting Apify actor: ${actorId}`);
    console.log(`[Threads] Query: ${query}`);

    // Actor を実行
    const runResponse = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }
    );

    if (!runResponse.ok) {
      throw new Error(`Failed to start actor: ${runResponse.statusText}`);
    }

    const runData = await runResponse.json();
    const runId = runData.data.id;
    console.log(`[Threads] Run started: ${runId}`);

    // 完了を待つ
    let status = 'RUNNING';
    while (status === 'RUNNING' || status === 'READY') {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const statusResponse = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
      );
      const statusData = await statusResponse.json();
      status = statusData.data.status;
      console.log(`[Threads] Status: ${status}`);
    }

    if (status !== 'SUCCEEDED') {
      throw new Error(`Actor run failed: ${status}`);
    }

    // 結果を取得
    const datasetId = runData.data.defaultDatasetId;
    const resultsResponse = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}`
    );
    const posts = await resultsResponse.json();

    console.log(`[Threads] Found ${posts.length} posts`);

    // 結果を保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `threads-${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = {
      query,
      timestamp: new Date().toISOString(),
      source: 'threads_apify',
      platform: 'threads',
      count: posts.length,
      data: posts
    };

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`[Threads] Saved to: ${filepath}`);

    return result;

  } catch (error) {
    console.error('[Threads] Error:', error);
    throw error;
  }
}

// コマンドライン引数から検索キーワードを取得
const query = process.argv[2] || DEFAULT_QUERY;
scrapeThreads(query);
