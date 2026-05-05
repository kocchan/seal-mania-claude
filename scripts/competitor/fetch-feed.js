/**
 * 競合サイトのRSS/サイトマップを取得
 *
 * Usage:
 *   node scripts/competitor/fetch-feed.js --url "https://example.com"
 *   node scripts/competitor/fetch-feed.js --all
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../..');
const CONFIG_PATH = path.join(ROOT_DIR, 'config/competitors.json');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output/competitor/urls');

// ==========================================
// 設定
// ==========================================

const FEED_PATHS = ['/feed', '/rss.xml', '/feed.xml', '/rss', '/atom.xml'];
const SITEMAP_PATHS = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-posts.xml'];

const USER_AGENT = 'Mozilla/5.0 (compatible; SealManiaBot/1.0)';

// ==========================================
// ユーティリティ
// ==========================================

function getNowJST() {
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(now.getTime() + jstOffset);
  return jstDate.toISOString().replace('Z', '+09:00');
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ==========================================
// フィード検出・取得
// ==========================================

/**
 * RSSフィードを探して取得
 */
async function fetchRSSFeed(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');

  for (const feedPath of FEED_PATHS) {
    const feedUrl = base + feedPath;
    try {
      console.log(`[RSS] 試行中: ${feedUrl}`);
      const response = await axios.get(feedUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      });

      // XMLかどうかチェック
      const contentType = response.headers['content-type'] || '';
      const data = response.data;

      if (contentType.includes('xml') || data.includes('<rss') || data.includes('<feed')) {
        console.log(`[RSS] 発見: ${feedUrl}`);
        return { url: feedUrl, data, type: 'rss' };
      }
    } catch (e) {
      // 404等は無視して次へ
    }
  }

  return null;
}

/**
 * サイトマップを取得
 */
async function fetchSitemap(baseUrl) {
  const base = baseUrl.replace(/\/$/, '');

  for (const sitemapPath of SITEMAP_PATHS) {
    const sitemapUrl = base + sitemapPath;
    try {
      console.log(`[Sitemap] 試行中: ${sitemapUrl}`);
      const response = await axios.get(sitemapUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      });

      const data = response.data;
      if (data.includes('<urlset') || data.includes('<sitemapindex')) {
        console.log(`[Sitemap] 発見: ${sitemapUrl}`);
        return { url: sitemapUrl, data, type: 'sitemap' };
      }
    } catch (e) {
      // 404等は無視
    }
  }

  return null;
}

// ==========================================
// XMLパース
// ==========================================

/**
 * RSSフィードから記事URLを抽出
 */
function parseRSS(xmlData) {
  const items = [];

  // RSS 2.0形式
  const itemMatches = xmlData.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const itemXml = match[1];

    const titleMatch = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkMatch = itemXml.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/);
    const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const descMatch = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);

    if (linkMatch) {
      items.push({
        url: linkMatch[1].trim(),
        title: titleMatch ? titleMatch[1].trim() : '',
        pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
        description: descMatch ? descMatch[1].trim().substring(0, 200) : ''
      });
    }
  }

  // Atom形式
  if (items.length === 0) {
    const entryMatches = xmlData.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entryXml = match[1];

      const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/);
      const publishedMatch = entryXml.match(/<published>([\s\S]*?)<\/published>/);
      const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);

      if (linkMatch) {
        items.push({
          url: linkMatch[1].trim(),
          title: titleMatch ? titleMatch[1].trim() : '',
          pubDate: publishedMatch ? publishedMatch[1].trim() : '',
          description: summaryMatch ? summaryMatch[1].trim().substring(0, 200) : ''
        });
      }
    }
  }

  return items;
}

/**
 * サイトマップから記事URLを抽出
 */
function parseSitemap(xmlData) {
  const items = [];

  // URLセット形式
  const urlMatches = xmlData.matchAll(/<url>([\s\S]*?)<\/url>/g);
  for (const match of urlMatches) {
    const urlXml = match[1];

    const locMatch = urlXml.match(/<loc>([\s\S]*?)<\/loc>/);
    const lastmodMatch = urlXml.match(/<lastmod>([\s\S]*?)<\/lastmod>/);

    if (locMatch) {
      const url = locMatch[1].trim();
      // カテゴリやタグページを除外
      if (!url.includes('/category/') && !url.includes('/tag/') && !url.includes('/page/')) {
        items.push({
          url,
          title: '',
          pubDate: lastmodMatch ? lastmodMatch[1].trim() : '',
          description: ''
        });
      }
    }
  }

  return items;
}

// ==========================================
// メイン処理
// ==========================================

async function processCompetitor(competitor) {
  const { name, domain, url, feedUrl } = competitor;
  console.log(`\n[処理開始] ${name} (${domain})`);

  let feedData = null;

  // 設定済みフィードURLがあればそれを使う
  if (feedUrl) {
    try {
      console.log(`[Feed] 設定済みURL使用: ${feedUrl}`);
      const response = await axios.get(feedUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000
      });
      feedData = { url: feedUrl, data: response.data, type: 'rss' };
    } catch (e) {
      console.warn(`[Feed] 設定済みURL失敗: ${e.message}`);
    }
  }

  // RSSを探す
  if (!feedData) {
    feedData = await fetchRSSFeed(url);
  }

  // サイトマップを探す
  if (!feedData) {
    feedData = await fetchSitemap(url);
  }

  if (!feedData) {
    console.error(`[エラー] ${name}: フィードもサイトマップも見つかりませんでした`);
    return null;
  }

  // パース
  const items = feedData.type === 'rss'
    ? parseRSS(feedData.data)
    : parseSitemap(feedData.data);

  console.log(`[結果] ${items.length}件の記事URLを取得`);

  // 結果を保存
  const timestamp = new Date().toISOString().split('T')[0];
  const result = {
    domain,
    name,
    fetchedAt: getNowJST(),
    source: feedData.type,
    sourceUrl: feedData.url,
    count: items.length,
    urls: items
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(OUTPUT_DIR, `${domain}-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`[保存] ${outputPath}`);

  return result;
}

async function main() {
  const args = process.argv.slice(2);

  // 単一URL指定
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    const url = args[urlIndex + 1];
    const domain = getDomain(url);
    const result = await processCompetitor({
      name: domain,
      domain,
      url
    });
    if (result) {
      console.log(`\n完了: ${result.count}件の記事URLを取得しました`);
    }
    return;
  }

  // 全サイト処理
  if (args.includes('--all')) {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error(`設定ファイルが見つかりません: ${CONFIG_PATH}`);
      console.log('config/competitors.json を作成してください');
      process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    const competitors = config.competitors.filter(c => c.enabled !== false);

    console.log(`${competitors.length}件の競合サイトを処理します`);

    for (const competitor of competitors) {
      await processCompetitor(competitor);
    }

    console.log('\n全て完了');
    return;
  }

  // ヘルプ
  console.log(`
競合サイトフィード取得スクリプト

Usage:
  node scripts/competitor/fetch-feed.js --url "https://example.com"
  node scripts/competitor/fetch-feed.js --all

Options:
  --url <URL>  単一サイトを指定
  --all        config/competitors.json の全サイトを処理
  `);
}

main().catch(console.error);
