/**
 * Yahoo リアルタイム検索からX（Twitter）の投稿を取得する
 *
 * 使い方:
 *   node .claude/skills/collect-x/scrape-yahoo.js [検索キーワード]
 *
 * 出力:
 *   output/blog/raw/yahoo-{timestamp}.json
 *
 * 機能:
 *   - 相対時間を実際の日時に変換
 *   - 前回取得済みの投稿は除外
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

/**
 * 相対時間を実際の日時に変換
 * 例: "3分前" -> "2026-04-29T14:00:00.000Z"
 *     "昨日 22:15" -> "2026-04-28T13:15:00.000Z"
 */
function parseRelativeTime(relativeTime, now = new Date()) {
  if (!relativeTime) return null;

  // "X秒前"
  const secMatch = relativeTime.match(/(\d+)秒前/);
  if (secMatch) {
    const date = new Date(now.getTime() - parseInt(secMatch[1]) * 1000);
    return date.toISOString();
  }

  // "X分前"
  const minMatch = relativeTime.match(/(\d+)分前/);
  if (minMatch) {
    const date = new Date(now.getTime() - parseInt(minMatch[1]) * 60 * 1000);
    return date.toISOString();
  }

  // "X時間前"
  const hourMatch = relativeTime.match(/(\d+)時間前/);
  if (hourMatch) {
    const date = new Date(now.getTime() - parseInt(hourMatch[1]) * 60 * 60 * 1000);
    return date.toISOString();
  }

  // "昨日 HH:MM"
  const yesterdayMatch = relativeTime.match(/昨日\s*(\d{1,2}):(\d{2})/);
  if (yesterdayMatch) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(parseInt(yesterdayMatch[1]), parseInt(yesterdayMatch[2]), 0, 0);
    return date.toISOString();
  }

  // "M月D日" or "MM/DD HH:MM"
  const dateMatch = relativeTime.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    const date = new Date(now);
    date.setMonth(parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  // "HH:MM" (今日)
  const timeMatch = relativeTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const date = new Date(now);
    date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    return date.toISOString();
  }

  return null;
}

/**
 * 前回取得済みのURLを取得
 */
function getPreviousUrls() {
  const urls = new Set();

  if (!fs.existsSync(OUTPUT_DIR)) return urls;

  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.startsWith('yahoo-') && f.endsWith('.json'))
    .sort()
    .reverse();

  // 直近のファイルから取得済みURLを収集
  for (const file of files.slice(0, 5)) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, file), 'utf-8'));
      for (const tweet of data.data || []) {
        if (tweet.url) urls.add(tweet.url);
      }
    } catch (e) {
      // ignore
    }
  }

  return urls;
}

async function scrapeYahooRealtime(query = DEFAULT_QUERY) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const now = new Date();
  const previousUrls = getPreviousUrls();

  console.log(`[Yahoo] Previous URLs count: ${previousUrls.size}`);

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
    const tweets = rawTweets
      .filter(t => !previousUrls.has(t.url))
      .map(t => ({
        text: t.text,
        user: t.user,
        time: parseRelativeTime(t.timeRaw, now) || t.timeRaw,
        timeRaw: t.timeRaw,
        url: t.url
      }));

    console.log(`[Yahoo] New tweets: ${tweets.length} (filtered ${rawTweets.length - tweets.length} duplicates)`);

    // 結果を保存
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `yahoo-${timestamp}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const result = {
      query,
      timestamp: now.toISOString(),
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
