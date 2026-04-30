/**
 * Yahoo リアルタイム検索からX（Twitter）の投稿を取得する
 *
 * 使い方:
 *   node scripts/scrape-yahoo.js
 *
 * 出力:
 *   output/blog/raw/yahoo-{YYYY-MM-DD}.json
 *
 * 機能:
 *   - 複数クエリ対応
 *   - 相対時間を実際の日時に変換
 *   - 1日1ファイル（同じ日に実行すると追記）
 *   - 重複投稿は除外
 *   - ブラックリスト・NGワード/URLによる自動BAN
 *   - 公式アカウント除外
 */

import { chromium } from 'playwright';
import {
  config,
  parseRelativeTime,
  loadBlacklist,
  addToBlacklist,
  shouldFilterOut,
  getFilePath,
  loadExistingData,
  getExistingUrls,
  saveResult
} from './utils.js';

/**
 * Yahooリアルタイム検索からツイートを取得
 */
async function fetchTweetsFromYahoo(page, query) {
  const url = `https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(query)}&ei=UTF-8`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  return await page.evaluate(() => {
    const results = [];

    document.querySelectorAll('[class*="Tweet_TweetContainer"]').forEach(container => {
      const textEl = container.querySelector('[class*="Tweet_body"]');
      const userEl = container.querySelector('[class*="Tweet_authorName"]');
      const timeEl = container.querySelector('[class*="Tweet_time"]');

      // x.com/username/status/ID の形式のリンクを探す
      const allLinks = Array.from(container.querySelectorAll('a'));
      const statusLink = allLinks.find(a => a.href && a.href.includes('/status/'));
      const tweetUrl = statusLink?.href || '';
      const urlMatch = tweetUrl.match(/x\.com\/([^/?]+)\/status\/(\d+)/);

      if (textEl?.textContent && urlMatch) {
        const text = textEl.textContent.trim();

        // ハッシュタグを抽出
        const hashtags = [...text.matchAll(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g)]
          .map(m => m[0]);

        // 画像URLを抽出（アイコン以外）
        const images = Array.from(container.querySelectorAll('img'))
          .map(img => img.src)
          .filter(src => src && !src.includes('profile_images') && !src.includes('icon'));

        results.push({
          tweetId: urlMatch[2],
          userId: urlMatch[1],
          text: text,
          url: `https://x.com/${urlMatch[1]}/status/${urlMatch[2]}`, // クリーンなURL
          timeRaw: timeEl?.textContent?.trim() || '',
          user: userEl?.textContent?.trim() || '',
          hashtags: hashtags,
          images: images
        });
      }
    });

    return results;
  });
}

/**
 * メイン処理
 */
async function main() {
  console.log('[Yahoo] 処理開始');

  const timestamp = new Date();
  const filepath = getFilePath(timestamp, 'yahoo');
  const existingData = loadExistingData(filepath);
  const existingUrls = getExistingUrls(existingData);
  const blacklist = loadBlacklist();
  const officialSet = new Set(config.filter?.officialAccounts || []);
  const queries = config.queries || [config.theme.name];

  console.log(`[Yahoo] 既存URL数: ${existingUrls.size}`);
  console.log(`[Yahoo] ブラックリスト: ${blacklist.size}件`);
  console.log(`[Yahoo] クエリ数: ${queries.length}`);

  const browser = await chromium.launch({
    headless: config.scraping?.headless ?? true
  });
  const page = await browser.newPage();

  const metrics = { total: 0, saved: 0, banned: 0, skipped: 0 };
  const allNewTweets = [];

  try {
    for (const query of queries) {
      console.log(`[Yahoo] 検索: ${query.substring(0, 50)}...`);

      const rawTweets = await fetchTweetsFromYahoo(page, query);
      console.log(`[Yahoo] 取得: ${rawTweets.length}件`);
      metrics.total += rawTweets.length;

      for (const tweet of rawTweets) {
        // 重複チェック
        if (existingUrls.has(tweet.url)) {
          metrics.skipped++;
          continue;
        }

        // フィルタリング
        const filterResult = shouldFilterOut(tweet, blacklist, officialSet);

        if (filterResult === 'exclude') {
          metrics.skipped++;
          continue;
        }

        if (filterResult.action === 'ban') {
          addToBlacklist(blacklist, tweet.userId, filterResult.reason);
          metrics.banned++;
          continue;
        }

        // 保存対象
        existingUrls.add(tweet.url);
        allNewTweets.push({
          tweetId: tweet.tweetId,
          userId: tweet.userId,
          text: tweet.text,
          user: tweet.user,
          time: parseRelativeTime(tweet.timeRaw, timestamp) || tweet.timeRaw,
          timeRaw: tweet.timeRaw,
          url: tweet.url,
          hashtags: tweet.hashtags,
          images: tweet.images
        });
        metrics.saved++;
        process.stdout.write('.');
      }

      // クエリ間の待機
      const delay = config.scraping?.queryDelay || 3000;
      await page.waitForTimeout(delay);
    }

    console.log(''); // 改行

    // 既存データとマージ
    const allTweets = existingData?.data
      ? [...existingData.data, ...allNewTweets]
      : allNewTweets;

    // 結果を保存
    const result = {
      timestamp: timestamp.toISOString(),
      source: 'yahoo_realtime',
      platform: 'x',
      count: allTweets.length,
      data: allTweets
    };

    saveResult(filepath, result);

    console.log(`[Yahoo] 保存先: ${filepath}`);
    console.log(`[Yahoo] 完了: 取得 ${metrics.total}件 / 新規 ${metrics.saved}件 / BAN ${metrics.banned}件 / スキップ ${metrics.skipped}件`);
    console.log(`[Yahoo] 合計: ${allTweets.length}件`);

  } catch (error) {
    console.error('[Yahoo] エラー:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main();
