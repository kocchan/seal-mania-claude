/**
 * Yahoo リアルタイム検索からX（Twitter）の投稿を取得する
 *
 * 使い方:
 *   node scripts/scrape-yahoo.js [検索キーワード]
 *
 * 出力:
 *   output/blog/raw/yahoo-{YYYY-MM-DD}.json
 *
 * 機能:
 *   - 相対時間を実際の日時に変換
 *   - 1日1ファイル（同じ日に実行すると追記）
 *   - 重複投稿は除外
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseRelativeTime } from './time-utils.js';

// configからテーマを読み込む
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const DEFAULT_QUERY = config.theme.name;
const OUTPUT_DIR = 'output/blog/raw';

/**
 * 日付からファイルパスを取得
 */
function getFilePath(date) {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(OUTPUT_DIR, `yahoo-${dateStr}.json`);
}

/**
 * 既存ファイルからデータを読み込み
 */
function loadExistingData(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 既存データからURLセットを取得
 */
function getExistingUrls(existingData) {
  const urls = new Set();
  if (!existingData?.data) return urls;
  for (const tweet of existingData.data) {
    if (tweet.url) urls.add(tweet.url);
  }
  return urls;
}

async function scrapeYahooRealtime(query = DEFAULT_QUERY) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const timestamp = new Date(); // 基準時刻（相対時間の計算に使用）
  const filepath = getFilePath(timestamp);
  const existingData = loadExistingData(filepath);
  const existingUrls = getExistingUrls(existingData);

  console.log(`[Yahoo] Existing URLs count: ${existingUrls.size}`);

  try {
    const url = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(query)}`;
    console.log(`[Yahoo] Fetching: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle' });

    // ツイート要素を取得（クラス名にハッシュがついているので部分一致で検索）
    const rawTweets = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="Tweet_TweetContainer"]');

      return Array.from(items).map(item => {
        const textEl = item.querySelector('[class*="Tweet_body"]');
        const userEl = item.querySelector('[class*="Tweet_authorName"]');
        const timeEl = item.querySelector('[class*="Tweet_time"]');
        const linkEl = item.querySelector('a[class*="Tweet_overallLink"]');

        return {
          text: textEl?.textContent?.trim() || '',
          user: userEl?.textContent?.trim() || '',
          timeRaw: timeEl?.textContent?.trim() || '',
          url: linkEl?.href || ''
        };
      }).filter(t => t.text);
    });

    console.log(`[Yahoo] Found ${rawTweets.length} tweets`);

    // 時間を変換し、重複を除外
    const newTweets = rawTweets
      .filter(t => !existingUrls.has(t.url))
      .map(t => ({
        text: t.text,
        user: t.user,
        time: parseRelativeTime(t.timeRaw, timestamp) || t.timeRaw,
        timeRaw: t.timeRaw,
        url: t.url
      }));

    console.log(`[Yahoo] New tweets: ${newTweets.length} (filtered ${rawTweets.length - newTweets.length} duplicates)`);

    // 既存データとマージ
    const allTweets = existingData?.data
      ? [...existingData.data, ...newTweets]
      : newTweets;

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = {
      query,
      timestamp: timestamp.toISOString(),
      source: 'yahoo_realtime',
      platform: 'x',
      count: allTweets.length,
      data: allTweets
    };

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`[Yahoo] Saved to: ${filepath} (total: ${allTweets.length}, new: ${newTweets.length})`);

    return result;

  } catch (error) {
    console.error('[Yahoo] Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// コマンドライン引数から検索キーワードを取得
const query = process.argv[2] || DEFAULT_QUERY;
scrapeYahooRealtime(query);
