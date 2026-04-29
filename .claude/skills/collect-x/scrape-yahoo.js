/**
 * Yahoo リアルタイム検索からX（Twitter）の投稿を取得する
 *
 * 使い方:
 *   node .claude/skills/collect-x/scrape-yahoo.js [検索キーワード]
 *
 * 出力:
 *   output/blog/raw/yahoo-{timestamp}.json
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// configからテーマを読み込む
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../../../config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const DEFAULT_QUERY = config.theme.name;
const OUTPUT_DIR = 'output/blog/raw';

async function scrapeYahooRealtime(query = DEFAULT_QUERY) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const url = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(query)}`;
    console.log(`[Yahoo] Fetching: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle' });

    // ツイート要素を取得（クラス名にハッシュがついているので部分一致で検索）
    const tweets = await page.evaluate(() => {
      const items = document.querySelectorAll('[class*="Tweet_TweetContainer"]');

      return Array.from(items).map(item => {
        const textEl = item.querySelector('[class*="Tweet_body"]');
        const userEl = item.querySelector('[class*="Tweet_authorName"]');
        const timeEl = item.querySelector('[class*="Tweet_time"]');
        const linkEl = item.querySelector('a[class*="Tweet_overallLink"]');

        return {
          text: textEl?.textContent?.trim() || '',
          user: userEl?.textContent?.trim() || '',
          time: timeEl?.textContent?.trim() || '',
          url: linkEl?.href || ''
        };
      }).filter(t => t.text);
    });

    console.log(`[Yahoo] Found ${tweets.length} tweets`);

    // 結果を保存
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `yahoo-${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = {
      query,
      timestamp: new Date().toISOString(),
      source: 'yahoo_realtime',
      platform: 'x',
      count: tweets.length,
      data: tweets
    };

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
    console.log(`[Yahoo] Saved to: ${filepath}`);

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
