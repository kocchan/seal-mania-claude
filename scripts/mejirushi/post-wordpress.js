/**
 * めじるしアクセサリー新作記事をWordPressに投稿する
 * （scripts/newproduct/post-wordpress.js の複製・めじるし向け調整版）
 *
 * 使い方:
 *   node scripts/mejirushi/post-wordpress.js
 *
 * 入力:
 *   output/mejirushi/drafts/{date}/{slug}.md
 *   output/mejirushi/images/{date}/{slug}.png (任意)
 *
 * 機能:
 *   - Markdown記事をWordPressに投稿
 *   - アイキャッチ画像をアップロード（存在すれば）
 *   - カテゴリは config の slug から実行時にID解決（初回はfunctions.phpが自動作成）
 *   - 投稿済み記事はpostedフラグで管理
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =====================================
// 設定読み込み
// =====================================
const configPath = path.join(__dirname, '../../config/mejirushi.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const CONFIG = {
  draftsDir: config.output?.draftsDir || 'output/mejirushi/drafts',
  imagesDir: config.output?.imagesDir || 'output/mejirushi/images',
  waitMs: 2000,

  // アフィリエイトID
  affiliateIds: {
    amazon: process.env.AMAZON_ASSOCIATE_ID,
    rakuten: process.env.RAKUTEN_AFFILIATE_ID
  },

  // Yahoo API
  yahooClientId: process.env.YAHOO_CLIENT_ID
};

const CATEGORY_SLUGS = config.wordpress?.categorySlugs || { '親': 'mejirushi', '新作情報': 'mejirushi-new' };
const DEFAULT_TAGS = config.wordpress?.defaultTags || ['めじるしアクセサリー', '新作'];
const PRODUCT_FILTER = new RegExp(config.affiliate?.productFilterRegex || 'チャーム|めじるし|目印|アクセサリー', 'i');
const FALLBACK_KEYWORD = config.affiliate?.fallbackKeyword || 'めじるしアクセサリー';

// =====================================
// frontmatter パーサー
// =====================================
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  const frontmatter = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of frontmatterStr.split('\n')) {
    if (line.match(/^\s+-\s+/) && currentArray) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      if (value.startsWith('name:')) {
        const obj = {};
        obj.name = value.replace('name:', '').trim().replace(/^["']|["']$/g, '');
        currentArray.push(obj);
      } else {
        currentArray.push(value.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    if (line.match(/^\s+price:/) && currentArray && currentArray.length > 0) {
      const lastItem = currentArray[currentArray.length - 1];
      if (typeof lastItem === 'object') {
        lastItem.price = parseInt(line.replace(/^\s+price:\s*/, ''));
      }
      continue;
    }

    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === '') {
        frontmatter[key] = [];
        currentArray = frontmatter[key];
        currentKey = key;
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
        currentArray = null;
        currentKey = key;
      }
    }
  }

  return { frontmatter, body };
}

// =====================================
// Markdown → HTML 変換
// =====================================
function markdownToHtml(markdown) {
  let html = markdown;

  // 見出し
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 太字
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // リンク
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // リスト
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // テーブル（thead/tbody対応）
  html = html.replace(/(\|.+\|\n\|[-\s|]+\|\n)((?:\|.+\|\n?)+)/g, (match, header, body) => {
    // ヘッダー行
    const headerCells = header.split('\n')[0].split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const thead = `<thead><tr>${headerCells}</tr></thead>`;

    // ボディ行
    const bodyRows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    const tbody = `<tbody>${bodyRows}</tbody>`;

    return `<table style="width:100%; border-collapse:collapse; margin:20px 0;">${thead}${tbody}</table>`;
  });

  // 段落
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<')) return p;
    return `<p>${p}</p>`;
  }).join('\n\n');

  return html;
}

// =====================================
// Yahoo!ショッピング検索
// =====================================
async function fetchYahooProducts(keywords) {
  if (!CONFIG.yahooClientId) return [];

  const executeSearch = async (query, count = 3) => {
    try {
      console.log(`  🔎 Yahoo API: ${query}`);
      const response = await axios.get('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch', {
        params: {
          appid: CONFIG.yahooClientId,
          query: query,
          results: count,
          sort: '-score',
          image_size: 300
        }
      });
      const hits = response.data.hits;
      if (hits && hits.length > 0) {
        // めじるしアクセサリー関連商品のみに絞る（チャーム系キーワードを商品名に含むもの）
        return hits
          .filter(item => PRODUCT_FILTER.test(item.name || ''))
          .map(item => ({
            name: item.name,
            image: item.image?.medium || '',
            price: item.price,
            url: item.url
          }));
      }
      return [];
    } catch (e) {
      console.error(`  ⚠️ Yahoo APIエラー: ${e.response ? e.response.status : e.message}`);
      return [];
    }
  };

  const products = [];
  const usedUrls = new Set();

  for (const keyword of keywords) {
    if (products.length >= 3) break;
    const results = await executeSearch(keyword, 3);
    for (const product of results) {
      if (products.length >= 3) break;
      if (!usedUrls.has(product.url)) {
        usedUrls.add(product.url);
        products.push({ ...product, keyword });
      }
    }
  }

  if (products.length < 3) {
    const defaultResults = await executeSearch(FALLBACK_KEYWORD, 3);
    for (const product of defaultResults) {
      if (products.length >= 3) break;
      if (!usedUrls.has(product.url)) {
        usedUrls.add(product.url);
        products.push({ ...product, keyword: FALLBACK_KEYWORD });
      }
    }
  }

  return products;
}

// =====================================
// アフィリエイトHTML生成
// =====================================
function generateAffiliateHtml(keyword, productData) {
  if (!keyword) return '';

  const itemName = productData ? productData.name : keyword;
  const itemImage = (productData && productData.image) ? productData.image : 'https://placehold.jp/300x300.png?text=No%20Image';
  const itemPrice = productData ? `¥${productData.price.toLocaleString()}〜` : '';
  const encKey = encodeURIComponent(keyword);

  const amazonUrl = `https://www.amazon.co.jp/s?k=${encKey}&tag=${CONFIG.affiliateIds.amazon}`;
  const rakutenUrl = `https://hb.afl.rakuten.co.jp/hgc/${CONFIG.affiliateIds.rakuten}/?pc=${encodeURIComponent('https://search.rakuten.co.jp/search/mall/' + keyword)}`;
  const yahooSearchUrl = `https://shopping.yahoo.co.jp/search?p=${encKey}`;
  const mainLinkUrl = productData ? productData.url : yahooSearchUrl;

  return `
<div style="border: 2px solid #f2f2f2; border-radius: 4px; padding: 15px; margin: 20px 0 40px; background: #fff; display: flex; flex-wrap: wrap; align-items: center; gap: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
    <div style="flex: 0 0 120px; width: 120px; display: flex; justify-content: center; align-items: center; margin: 0 auto;">
        <a href="${mainLinkUrl}" target="_blank" rel="nofollow" style="display:block; border: none; box-shadow: none; background: none;">
            <img src="${itemImage}" alt="${keyword}" style="width: 100%; height: auto; max-height: 120px; object-fit: contain; border: none; margin: 0; padding: 0;">
        </a>
    </div>
    <div style="flex: 1 1 250px; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
        <div style="margin-bottom: 15px; text-align: left;">
            <a href="${mainLinkUrl}" target="_blank" rel="nofollow" style="font-weight: bold; color: #333; text-decoration: none; font-size: 14px; line-height: 1.4; display: block; border: none;">${itemName}</a>
            <div style="color: #d32f2f; font-size: 13px; margin-top: 5px;">${itemPrice}</div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 10px; width: 100%;">
            <a href="${amazonUrl}" target="_blank" rel="nofollow" style="flex: 1 1 200px; display: flex; justify-content: center; align-items: center; background: #ff9900; color: #fff; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 4px; height: 42px; box-shadow: 0 2px 0 #cc7a00; box-sizing: border-box;">Amazon</a>
            <a href="${rakutenUrl}" target="_blank" rel="nofollow" style="flex: 1 1 200px; display: flex; justify-content: center; align-items: center; background: #bf0000; color: #fff; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 4px; height: 42px; box-shadow: 0 2px 0 #990000; box-sizing: border-box;">楽天市場</a>
            <a href="${yahooSearchUrl}" target="_blank" rel="nofollow" style="flex: 1 1 200px; display: flex; justify-content: center; align-items: center; background: #51a7e8; color: #fff; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 4px; height: 42px; box-shadow: 0 2px 0 #2079b0; box-sizing: border-box;">Yahoo!ｼｮｯﾋﾟﾝｸﾞ</a>
        </div>
    </div>
</div>`;
}

// =====================================
// WordPressサービス
// =====================================
class WordPressService {
  constructor() {
    const { WP_API_URL, WP_USER, WP_APP_PASSWORD } = process.env;
    if (!WP_API_URL || !WP_USER || !WP_APP_PASSWORD) {
      throw new Error('❌ 環境変数が不足: WP_API_URL, WP_USER, WP_APP_PASSWORD');
    }
    this.apiUrl = WP_API_URL;
    this.auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
    this.categoryIdCache = {};
  }

  // slug → カテゴリID を実行時に解決（functions.php が初回作成するためIDを固定できない）
  async resolveCategoryId(slug) {
    if (!slug) return null;
    if (this.categoryIdCache[slug]) return this.categoryIdCache[slug];
    try {
      const res = await axios.get(`${this.apiUrl}/categories`, {
        params: { slug, _fields: 'id,slug' },
        headers: { 'Authorization': `Basic ${this.auth}` }
      });
      const found = res.data.find(c => c.slug === slug);
      if (found) {
        this.categoryIdCache[slug] = found.id;
        return found.id;
      }
      console.error(`  ⚠️ カテゴリが見つかりません: slug=${slug}（functions.phpの自動作成が未実行の可能性）`);
      return null;
    } catch (e) {
      console.error(`  ⚠️ カテゴリ解決失敗: ${slug} (${e.message})`);
      return null;
    }
  }

  async uploadImage(imagePath, slug) {
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.log(`  ⚠️ 画像が存在しません: ${imagePath}`);
      return null;
    }

    try {
      console.log(`  🖼️ 画像アップロード中: ${imagePath}`);
      const imageBuffer = fs.readFileSync(imagePath);

      const response = await axios.post(`${this.apiUrl}/media`, imageBuffer, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${slug}.png"`
        }
      });
      return response.data.id;
    } catch (error) {
      console.error(`  ❌ 画像アップロード失敗: ${error.message}`);
      return null;
    }
  }

  async getOrCreateTag(tagName) {
    if (!tagName) return null;
    try {
      const searchRes = await axios.get(`${this.apiUrl}/tags?search=${encodeURIComponent(tagName)}`, {
        headers: { 'Authorization': `Basic ${this.auth}` }
      });
      const existingTag = searchRes.data.find(t => t.name === tagName);
      if (existingTag) return existingTag.id;

      const createRes = await axios.post(`${this.apiUrl}/tags`, { name: tagName }, {
        headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json' }
      });
      return createRes.data.id;
    } catch (e) {
      console.error(`  ⚠️ タグ作成失敗: ${tagName}`);
      return null;
    }
  }

  async getCategoryIds() {
    // 親（めじるしアクセサリー）＋ 新作・ガチャ情報
    const ids = [
      await this.resolveCategoryId(CATEGORY_SLUGS['親']),
      await this.resolveCategoryId(CATEGORY_SLUGS['新作情報'])
    ];
    return [...new Set(ids.filter(id => id != null))];
  }

  async postArticle(frontmatter, htmlContent, imagePath) {
    // 画像アップロード
    const slug = frontmatter.slug || 'mejirushi-article';
    const mediaId = await this.uploadImage(imagePath, slug);

    // アフィリエイト検索キーワード：
    // キャラ・商品タグを必ず「めじるしアクセサリー」と組み合わせて検索する
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const excludeTags = new Set(['新作', 'ガチャ', 'めじるしアクセサリー', 'めじるしチャーム', '目印チャーム']);
    const productTags = tags.filter(t => !excludeTags.has(t));
    const searchKeywords = [
      ...productTags.map(t => `めじるしアクセサリー ${t}`),
      'めじるしアクセサリー',
      'めじるしチャーム ガチャ'
    ].slice(0, 5);
    const products = await fetchYahooProducts(searchKeywords);

    // アフィリエイトを分割（冒頭・中盤・末尾）
    const affiliateTop = products.slice(0, 3).map(p => generateAffiliateHtml(p.keyword, p)).join('\n');
    const affiliateMid = products.slice(0, 2).map(p => generateAffiliateHtml(p.keyword, p)).join('\n');
    const affiliateBottom = products.slice(0, 3).map(p => generateAffiliateHtml(p.keyword, p)).join('\n');

    // カテゴリ・タグ
    const categories = await this.getCategoryIds();
    const tagIds = [];

    // タグを作成/取得（configのdefaultTagsを使用）
    const tagNames = [...DEFAULT_TAGS, ...tags.slice(0, 5)];
    for (const tagName of [...new Set(tagNames)]) {
      const tagId = await this.getOrCreateTag(tagName);
      if (tagId) tagIds.push(tagId);
    }

    // コンテンツにアフィリエイトを挿入
    let finalContent = htmlContent;

    // 冒頭にアフィリエイト挿入（最初の見出しの後）
    finalContent = finalContent.replace(
      /(<\/h2>)/,
      `$1\n\n<h3>🛒 今すぐ探す</h3>\n${affiliateTop}\n`
    );

    // 中盤にアフィリエイト挿入（設置場所/どこで買えるセクションの前）
    finalContent = finalContent.replace(
      /(<h2>(どこで|設置場所|入手方法))/,
      `<h3>🛒 関連商品をチェック</h3>\n${affiliateMid}\n\n$1`
    );

    // 末尾にアフィリエイト
    finalContent = finalContent + '\n\n<h2>🛒 オンラインで探す</h2>\n' + affiliateBottom;

    // 投稿データ
    const payload = {
      title: frontmatter.title,
      content: finalContent,
      status: 'publish',
      slug: slug,
      categories: categories,
      tags: tagIds
    };
    if (mediaId) payload.featured_media = mediaId;

    try {
      console.log(`  🚀 WP投稿中: ${payload.title}`);
      const response = await axios.post(`${this.apiUrl}/posts`, payload, {
        headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      console.error(`  ❌ WP投稿失敗: ${error.response?.data?.message || error.message}`);
      return null;
    }
  }
}

// =====================================
// frontmatter更新
// =====================================
function updateFrontmatterPosted(filePath, content, wpPostId, wpPostUrl) {
  const now = new Date().toISOString();
  const fields = [
    ['posted', 'true'],
    ['wpPostId', String(wpPostId)],
    ['wpPostUrl', `"${wpPostUrl}"`],
    ['postedAt', `"${now}"`],
  ];

  let updatedContent = content;
  for (const [key, value] of fields) {
    const lineRegex = new RegExp(`^${key}:.*$`, 'm');
    if (lineRegex.test(updatedContent)) {
      updatedContent = updatedContent.replace(lineRegex, `${key}: ${value}`);
    } else {
      updatedContent = updatedContent.replace(/^(---\n)/, `---\n${key}: ${value}\n`);
    }
  }
  fs.writeFileSync(filePath, updatedContent);
}

// =====================================
// メイン処理
// =====================================
async function main() {
  console.log('[WordPress] めじるしアクセサリー新作記事投稿開始');

  if (!fs.existsSync(CONFIG.draftsDir)) {
    console.log('[WordPress] draftsディレクトリが見つかりません');
    return;
  }

  const wpService = new WordPressService();
  let totalPosted = 0;
  let totalSkipped = 0;

  const dateDirs = fs.readdirSync(CONFIG.draftsDir).filter(d =>
    fs.statSync(path.join(CONFIG.draftsDir, d)).isDirectory()
  );

  for (const dateDir of dateDirs) {
    const datePath = path.join(CONFIG.draftsDir, dateDir);
    const files = fs.readdirSync(datePath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      // posted: true ならスキップ
      if (frontmatter.posted === 'true' || frontmatter.posted === true) {
        totalSkipped++;
        continue;
      }

      // 画像は必須としない（画像があれば添付、なければアイキャッチなしで投稿）

      const slug = file.replace('.md', '');
      console.log(`\n[WordPress] 処理中: ${dateDir}/${slug}`);

      // 画像パス
      const imagePath = path.join(process.cwd(), CONFIG.imagesDir, dateDir, `${slug}.png`);

      // Markdown → HTML
      const htmlContent = markdownToHtml(body);

      // 投稿
      const result = await wpService.postArticle(frontmatter, htmlContent, imagePath);

      if (result?.id) {
        updateFrontmatterPosted(filePath, content, result.id, result.link);
        totalPosted++;
        console.log(`  ✅ 投稿完了: ${result.link}`);
      }

      await new Promise(res => setTimeout(res, CONFIG.waitMs));
    }
  }

  console.log('\n========================================');
  console.log(`[WordPress] 完了: 投稿 ${totalPosted}件 / スキップ ${totalSkipped}件`);
}

main().catch(console.error);
