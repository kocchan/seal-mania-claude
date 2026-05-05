/**
 * 競合サイトの記事本文を抽出
 *
 * Usage:
 *   node scripts/competitor/scrape-article.js --url "https://example.com/article/"
 *   node scripts/competitor/scrape-article.js --domain "example.com" --limit 5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '../..');
const URLS_DIR = path.join(ROOT_DIR, 'output/competitor/urls');
const RAW_DIR = path.join(ROOT_DIR, 'output/competitor/raw');

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
    return 'unknown';
  }
}

function getSlug(url) {
  try {
    const pathname = new URL(url).pathname;
    // 最後のパス部分を取得
    const parts = pathname.split('/').filter(Boolean);
    let slug = parts[parts.length - 1] || 'index';
    // .htmlなどの拡張子を除去
    slug = slug.replace(/\.(html?|php)$/, '');
    // 長すぎる場合は切り詰め
    if (slug.length > 50) {
      slug = slug.substring(0, 50);
    }
    return slug;
  } catch {
    return 'article';
  }
}

// ==========================================
// HTML → テキスト変換
// ==========================================

/**
 * HTMLからメインコンテンツを抽出
 */
function extractMainContent(html) {
  // scriptとstyleタグを除去
  let content = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // メインコンテンツ領域を探す
  const mainSelectors = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*(?:entry-content|post-content|article-content|content|main-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="[^"]*(?:content|main|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const selector of mainSelectors) {
    const match = content.match(selector);
    if (match && match[1]) {
      content = match[1];
      break;
    }
  }

  return content;
}

/**
 * HTMLタグをMarkdownに変換
 */
function htmlToMarkdown(html) {
  let text = html;

  // 見出しを変換
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  text = text.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '\n##### $1\n');
  text = text.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '\n###### $1\n');

  // 段落
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');

  // リスト
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  text = text.replace(/<[ou]l[^>]*>/gi, '\n');
  text = text.replace(/<\/[ou]l>/gi, '\n');

  // 強調
  text = text.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  text = text.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  text = text.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  text = text.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');

  // リンク
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');

  // 画像
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '![$1]($2)');
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // 改行
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // テーブル（簡易変換）
  text = text.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, '$1\n');
  text = text.replace(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi, '| $1 ');

  // blockquote
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '\n> $1\n');

  // 残りのHTMLタグを除去
  text = text.replace(/<[^>]+>/g, '');

  // HTMLエンティティをデコード
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));

  // 連続する空行を削減
  text = text.replace(/\n{3,}/g, '\n\n');

  // 前後の空白を整理
  text = text.trim();

  return text;
}

/**
 * 見出し構造を抽出
 */
function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1].charAt(1));
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

/**
 * タイトルを抽出
 */
function extractTitle(html) {
  // og:title
  const ogMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogMatch) return ogMatch[1];

  // titleタグ
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    // サイト名を除去（「 | 」や「 - 」で区切られている場合）
    let title = titleMatch[1].trim();
    title = title.split(/\s*[||-]\s*/)[0].trim();
    return title;
  }

  // h1タグ
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].replace(/<[^>]+>/g, '').trim();
  }

  return '';
}

// ==========================================
// 記事取得
// ==========================================

async function scrapeArticle(url) {
  console.log(`[取得中] ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3'
      },
      timeout: 15000
    });

    const html = response.data;
    const domain = getDomain(url);
    const slug = getSlug(url);

    // タイトル抽出
    const title = extractTitle(html);

    // メインコンテンツ抽出
    const mainContent = extractMainContent(html);

    // Markdownに変換
    const markdown = htmlToMarkdown(mainContent);

    // 見出し構造を抽出
    const headings = extractHeadings(mainContent);

    // 文字数カウント
    const charCount = markdown.replace(/\s/g, '').length;

    // 結果を組み立て
    const result = {
      url,
      domain,
      title,
      slug,
      headings,
      charCount,
      content: markdown,
      fetchedAt: getNowJST()
    };

    // ファイルとして保存
    const outputDir = path.join(RAW_DIR, domain);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `${slug}.md`);
    const fileContent = `---
source: ${domain}
sourceUrl: "${url}"
title: "${title.replace(/"/g, '\\"')}"
charCount: ${charCount}
headings:
${headings.map(h => `  - level: ${h.level}\n    text: "${h.text.replace(/"/g, '\\"')}"`).join('\n')}
fetchedAt: "${result.fetchedAt}"
---

# ${title}

${markdown}
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`[保存] ${outputPath} (${charCount}文字)`);

    return result;

  } catch (e) {
    console.error(`[エラー] ${url}: ${e.message}`);
    return null;
  }
}

// ==========================================
// メイン処理
// ==========================================

async function main() {
  const args = process.argv.slice(2);

  // 単一URL指定
  const urlIndex = args.indexOf('--url');
  if (urlIndex !== -1 && args[urlIndex + 1]) {
    const url = args[urlIndex + 1];
    const result = await scrapeArticle(url);
    if (result) {
      console.log(`\n完了: ${result.charCount}文字を抽出しました`);
    }
    return;
  }

  // ドメイン指定で最新URLリストから取得
  const domainIndex = args.indexOf('--domain');
  if (domainIndex !== -1 && args[domainIndex + 1]) {
    const domain = args[domainIndex + 1];

    // 最新のURLリストファイルを探す
    const files = fs.readdirSync(URLS_DIR)
      .filter(f => f.startsWith(domain) && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.error(`URLリストが見つかりません: ${domain}`);
      console.log('先に fetch-feed.js を実行してください');
      process.exit(1);
    }

    const latestFile = path.join(URLS_DIR, files[0]);
    console.log(`[読込] ${latestFile}`);
    const data = JSON.parse(fs.readFileSync(latestFile, 'utf-8'));

    // limit取得
    const limitIndex = args.indexOf('--limit');
    const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : 5;

    const urls = data.urls.slice(0, limit);
    console.log(`${urls.length}件の記事を取得します\n`);

    let success = 0;
    for (const item of urls) {
      const result = await scrapeArticle(item.url);
      if (result) success++;
      // レート制限対策
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n完了: ${success}/${urls.length}件を取得しました`);
    return;
  }

  // ヘルプ
  console.log(`
競合サイト記事本文抽出スクリプト

Usage:
  node scripts/competitor/scrape-article.js --url "https://example.com/article/"
  node scripts/competitor/scrape-article.js --domain "example.com" --limit 5

Options:
  --url <URL>       単一記事URLを指定
  --domain <DOMAIN> URLリストから該当ドメインの記事を取得
  --limit <N>       取得する記事数（デフォルト: 5）
  `);
}

main().catch(console.error);
