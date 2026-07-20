/**
 * RSS フィードから新作情報を取得し、各記事 URL をスクレイピングして保存する
 *
 * 使い方:
 *   node scripts/rss/scrape.js
 *
 * 環境変数:
 *   RSS_FEED_URLS  - カンマ区切りの RSS フィード URL（Google アラート等）
 *
 * 出力:
 *   output/rss/{date}/{slug}.md
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, '../../config/rss.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const CONFIG = {
  rssDir: config.output.rssDir,
  maxItemsPerFeed: config.rss.maxItemsPerFeed,
  filterKeywords: config.rss.filterKeywords || [],
  timeoutMs: config.scraping.timeoutMs,
  userAgent: config.scraping.userAgent,
  minBodyChars: config.scraping.minBodyChars,
  useFallbackPlaywright: config.scraping.useFallbackPlaywright,
  delayMs: config.scraping.delayMsBetweenRequests
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// =====================================
// RSS フィード取得・パース
// =====================================
async function fetchFeed(url) {
  const res = await axios.get(url, {
    timeout: CONFIG.timeoutMs,
    headers: { 'User-Agent': CONFIG.userAgent },
    responseType: 'text'
  });
  return res.data;
}

function parseFeed(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];

  $('entry').each((_, el) => {
    const $el = $(el);
    const title = stripTags($el.find('title').first().text() || '').trim();
    const link = $el.find('link').first().attr('href') || '';
    const published = $el.find('published').first().text() || $el.find('updated').first().text() || '';
    const summary = stripTags($el.find('content').first().text() || $el.find('summary').first().text() || '');
    items.push({ title, link, published, summary });
  });

  if (items.length === 0) {
    $('item').each((_, el) => {
      const $el = $(el);
      const title = stripTags($el.find('title').first().text() || '').trim();
      const link = ($el.find('link').first().text() || '').trim();
      const published = $el.find('pubDate').first().text() || '';
      const summary = stripTags($el.find('description').first().text() || '');
      items.push({ title, link, published, summary });
    });
  }

  return items;
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractRealUrl(googleRedirectUrl) {
  try {
    const u = new URL(googleRedirectUrl);
    if (u.hostname.includes('google.com')) {
      const real = u.searchParams.get('url') || u.searchParams.get('q');
      if (real) return real;
    }
    return googleRedirectUrl;
  } catch {
    return googleRedirectUrl;
  }
}

function matchesKeywords(text) {
  if (CONFIG.filterKeywords.length === 0) return true;
  const t = String(text || '');
  return CONFIG.filterKeywords.some((kw) => t.includes(kw));
}

// =====================================
// 記事スクレイピング
// =====================================
async function fetchArticleAxios(url) {
  const res = await axios.get(url, {
    timeout: CONFIG.timeoutMs,
    headers: { 'User-Agent': CONFIG.userAgent },
    responseType: 'text',
    maxRedirects: 5,
    validateStatus: (s) => s >= 200 && s < 400
  });
  return res.data;
}

async function fetchArticlePlaywright(url) {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ userAgent: CONFIG.userAgent });
    const page = await ctx.newPage();
    await page.goto(url, { timeout: CONFIG.timeoutMs, waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    return await page.content();
  } finally {
    await browser.close();
  }
}

function sanitizeHtml(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript, iframe, object, embed, link[rel="stylesheet"]').remove();
  $('*').each((_, el) => {
    if (el.attribs) {
      for (const attr of Object.keys(el.attribs)) {
        if (/^on/i.test(attr)) delete el.attribs[attr];
        if (attr === 'style') delete el.attribs[attr];
      }
    }
  });
  return $.html();
}

function extractMain($) {
  const candidates = [
    'article',
    'main',
    '[role="main"]',
    '.article-body',
    '.entry-content',
    '.post-content',
    '.content',
    '#content',
    '#main'
  ];
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 200) {
      return el.html();
    }
  }
  return $('body').html() || '';
}

function extractOgImage($) {
  return (
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    $('meta[name="og:image"]').attr('content') ||
    null
  );
}

function extractMeta($) {
  return {
    title:
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text() ||
      '',
    description:
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '',
    siteName: $('meta[property="og:site_name"]').attr('content') || ''
  };
}

async function scrapeArticle(url) {
  let html = null;
  let method = 'axios';
  try {
    html = await fetchArticleAxios(url);
  } catch (e) {
    if (!CONFIG.useFallbackPlaywright) throw e;
    html = await fetchArticlePlaywright(url);
    method = 'playwright';
  }

  let $ = cheerio.load(html);
  let bodyText = $('body').text().replace(/\s+/g, ' ').trim();

  if (bodyText.length < CONFIG.minBodyChars && CONFIG.useFallbackPlaywright && method === 'axios') {
    try {
      html = await fetchArticlePlaywright(url);
      $ = cheerio.load(html);
      bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      method = 'playwright';
    } catch (e) {
      // 軽量取得で取れたぶんだけ使う
    }
  }

  const meta = extractMeta($);
  const ogImage = extractOgImage($);
  const mainHtmlRaw = extractMain($);
  const mainHtml = sanitizeHtml(mainHtmlRaw || '');

  return { method, meta, ogImage, mainHtml, bodyText };
}

// =====================================
// 保存
// =====================================
function slugFromUrl(url, title) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '').replace(/\./g, '-');
    const last = (u.pathname.split('/').filter(Boolean).pop() || '').replace(/\.[a-z0-9]+$/i, '');
    const tail = last || title.slice(0, 24);
    const safe = tail.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return `${host}-${safe || 'item'}`;
  } catch {
    return 'item-' + Date.now();
  }
}

function todayJst() {
  const now = new Date();
  const j = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return j.toISOString().slice(0, 10);
}

function loadExistingUrls() {
  const set = new Set();
  if (!fs.existsSync(CONFIG.rssDir)) return set;
  const dates = fs.readdirSync(CONFIG.rssDir).filter((d) =>
    fs.statSync(path.join(CONFIG.rssDir, d)).isDirectory()
  );
  for (const d of dates) {
    const files = fs.readdirSync(path.join(CONFIG.rssDir, d)).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(CONFIG.rssDir, d, f), 'utf-8');
      const m = content.match(/^url:\s*"?([^"\n]+)"?$/m);
      if (m) set.add(m[1].trim());
    }
  }
  return set;
}

function frontmatterEscape(s) {
  return String(s || '').replace(/"/g, '\\"').replace(/\n/g, ' ').slice(0, 500);
}

function buildMarkdown({ url, item, scraped }) {
  const fm = [
    '---',
    `source: rss`,
    `url: "${frontmatterEscape(url)}"`,
    `title: "${frontmatterEscape(scraped.meta.title || item.title)}"`,
    `siteName: "${frontmatterEscape(scraped.meta.siteName)}"`,
    `publishedAt: "${frontmatterEscape(item.published)}"`,
    `fetchedAt: "${new Date().toISOString()}"`,
    `fetchMethod: ${scraped.method}`,
    `ogImage: "${frontmatterEscape(scraped.ogImage || '')}"`,
    `description: "${frontmatterEscape(scraped.meta.description)}"`,
    '---',
    ''
  ].join('\n');

  return `${fm}\n## RSS要約\n\n${item.summary || '(空)'}\n\n## 本文HTML（サニタイズ済み）\n\n${scraped.mainHtml || '(空)'}\n`;
}

// =====================================
// メイン
// =====================================
async function main() {
  console.log('[RSS] 新作情報収集開始');

  const feedUrls = (process.env.RSS_FEED_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (feedUrls.length === 0) {
    console.error('[RSS] RSS_FEED_URLS が設定されていません。.env か GitHub Secrets で設定してください');
    process.exit(1);
  }

  const existingUrls = loadExistingUrls();
  console.log(`[RSS] 既存記事: ${existingUrls.size}件`);

  let totalFetched = 0;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const feedUrl of feedUrls) {
    console.log(`\n[RSS] フィード取得: ${feedUrl}`);
    let items;
    try {
      const xml = await fetchFeed(feedUrl);
      items = parseFeed(xml).slice(0, CONFIG.maxItemsPerFeed);
      console.log(`  └ ${items.length}件`);
    } catch (e) {
      console.error(`  ✗ フィード取得失敗: ${e.message}`);
      totalErrors++;
      continue;
    }

    for (const item of items) {
      totalFetched++;
      const realUrl = extractRealUrl(item.link);

      if (!realUrl || !/^https?:\/\//.test(realUrl)) {
        totalSkipped++;
        continue;
      }
      if (existingUrls.has(realUrl)) {
        totalSkipped++;
        continue;
      }

      console.log(`\n  ▶ ${item.title}`);
      console.log(`     → ${realUrl}`);

      try {
        const scraped = await scrapeArticle(realUrl);

        // タイトル・description・本文冒頭のいずれかにキーワードがあれば採用
        // （以前はdescriptionのみ判定で、タイトルに「めじるし」等があっても弾いていた）
        const haystack = [
          item.title || '',
          scraped.meta.title || '',
          scraped.meta.description || '',
          String(scraped.bodyText || '').slice(0, 2000)
        ].join(' ');
        if (!matchesKeywords(haystack)) {
          console.log('     ⏭️ タイトル/description/本文にキーワード不一致: スキップ');
          totalSkipped++;
          continue;
        }

        const date = todayJst();
        const slug = slugFromUrl(realUrl, item.title);
        const outDir = path.join(CONFIG.rssDir, date);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `${slug}.md`);

        if (fs.existsSync(outPath)) {
          console.log('     ⏭️ 同名ファイル存在: スキップ');
          totalSkipped++;
        } else {
          const md = buildMarkdown({ url: realUrl, item, scraped });
          fs.writeFileSync(outPath, md, 'utf-8');
          console.log(`     ✅ 保存: ${outPath} (${scraped.method})`);
          existingUrls.add(realUrl);
          totalSaved++;
        }
      } catch (e) {
        console.error(`     ✗ スクレイピング失敗: ${e.message}`);
        totalErrors++;
      }

      await sleep(CONFIG.delayMs);
    }
  }

  console.log('\n========================================');
  console.log(
    `[RSS] 完了: 取得${totalFetched}件 / 保存${totalSaved}件 / スキップ${totalSkipped}件 / エラー${totalErrors}件`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
