/**
 * 目撃情報をWordPressに投稿する
 *
 * 使い方:
 *   node scripts/sightings/post-wordpress.js
 *
 * 入力:
 *   output/sightings/articles/{日付}.json
 *   output/sightings/images/{tweetId}.png
 *
 * 機能:
 *   - 記事データをWordPressに投稿
 *   - アイキャッチ画像をアップロード
 *   - Yahoo!ショッピングAPIでアフィリエイトリンク生成
 *   - 投稿済み記事はisPostedフラグで管理
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config, getNowJST } from './utils.js';

// =====================================
// 設定
// =====================================
const APP_CONFIG = {
  articlesDir: config.output?.sightingsDir ? `${config.output.sightingsDir}/articles` : 'output/sightings/articles',
  imagesDir: config.output?.sightingsDir ? `${config.output.sightingsDir}/images` : 'output/sightings/images',
  waitMs: 2000,

  // アフィリエイトID（.envから取得）
  affiliateIds: {
    amazon: process.env.AMAZON_ASSOCIATE_ID,
    rakuten: process.env.RAKUTEN_AFFILIATE_ID
  },

  // Yahoo API（.envから取得）
  yahooClientId: process.env.YAHOO_CLIENT_ID
};

// config/sightings.jsonからWordPress設定を取得
const WP_CONFIG = config.wordpress || {};
const PREF_TO_REGION_MAP = WP_CONFIG.prefToRegionMap || {};
const WP_CATEGORY_MAP = WP_CONFIG.categoryMap || {};

// =====================================
// 都道府県のローマ字マッピング
// =====================================
const PREF_ROMAJI_MAP = {
  "北海道": "hokkaido", "青森県": "aomori", "青森": "aomori", "岩手県": "iwate", "岩手": "iwate",
  "宮城県": "miyagi", "宮城": "miyagi", "秋田県": "akita", "秋田": "akita",
  "山形県": "yamagata", "山形": "yamagata", "福島県": "fukushima", "福島": "fukushima",
  "茨城県": "ibaraki", "茨城": "ibaraki", "栃木県": "tochigi", "栃木": "tochigi",
  "群馬県": "gunma", "群馬": "gunma", "埼玉県": "saitama", "埼玉": "saitama",
  "千葉県": "chiba", "千葉": "chiba", "東京都": "tokyo", "東京": "tokyo",
  "神奈川県": "kanagawa", "神奈川": "kanagawa",
  "新潟県": "niigata", "新潟": "niigata", "富山県": "toyama", "富山": "toyama",
  "石川県": "ishikawa", "石川": "ishikawa", "福井県": "fukui", "福井": "fukui",
  "山梨県": "yamanashi", "山梨": "yamanashi", "長野県": "nagano", "長野": "nagano",
  "岐阜県": "gifu", "岐阜": "gifu", "静岡県": "shizuoka", "静岡": "shizuoka",
  "愛知県": "aichi", "愛知": "aichi",
  "三重県": "mie", "三重": "mie", "滋賀県": "shiga", "滋賀": "shiga",
  "京都府": "kyoto", "京都": "kyoto", "大阪府": "osaka", "大阪": "osaka",
  "兵庫県": "hyogo", "兵庫": "hyogo", "奈良県": "nara", "奈良": "nara",
  "和歌山県": "wakayama", "和歌山": "wakayama",
  "鳥取県": "tottori", "鳥取": "tottori", "島根県": "shimane", "島根": "shimane",
  "岡山県": "okayama", "岡山": "okayama", "広島県": "hiroshima", "広島": "hiroshima",
  "山口県": "yamaguchi", "山口": "yamaguchi",
  "徳島県": "tokushima", "徳島": "tokushima", "香川県": "kagawa", "香川": "kagawa",
  "愛媛県": "ehime", "愛媛": "ehime", "高知県": "kochi", "高知": "kochi",
  "福岡県": "fukuoka", "福岡": "fukuoka", "佐賀県": "saga", "佐賀": "saga",
  "長崎県": "nagasaki", "長崎": "nagasaki", "熊本県": "kumamoto", "熊本": "kumamoto",
  "大分県": "oita", "大分": "oita", "宮崎県": "miyazaki", "宮崎": "miyazaki",
  "鹿児島県": "kagoshima", "鹿児島": "kagoshima", "沖縄県": "okinawa", "沖縄": "okinawa"
};

// =====================================
// 市区町村の英語化
// =====================================
async function getEnglishCityName(cityStr) {
  if (!cityStr || cityStr === "unknown") return "unknown";
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(cityStr)}`;
    const res = await axios.get(url);
    let englishName = res.data[0][0][0];
    englishName = englishName.toLowerCase()
      .replace(/\b(city|ward|town|village|prefecture)\b/g, '')
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return englishName || "unknown";
  } catch (error) {
    console.error(`  ⚠️ 市区町村の英語化失敗 (${cityStr}):`, error.message);
    return "unknown";
  }
}

// =====================================
// Yahoo!ショッピング検索（複数商品取得）
// =====================================
async function fetchYahooProducts(keywords) {
  if (!APP_CONFIG.yahooClientId) return [];

  const executeSearch = async (query, count = 3) => {
    try {
      console.log(`  🔎 Yahoo API: ${query}`);
      const response = await axios.get('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch', {
        params: {
          appid: APP_CONFIG.yahooClientId,
          query: query,
          results: count,
          sort: '-score',
          image_size: 300
        }
      });
      const hits = response.data.hits;
      if (hits && hits.length > 0) {
        // ボンボンドロップシール関連商品のみに絞る（シール系キーワードを商品名に含むもの）
        return hits
          .filter(item => /シール|ステッカー|ボンボン|ぷっくり|うるちゅる|seal|sticker|bonbon/i.test(item.name || ''))
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

  // 各キーワードで検索して重複を除外しながら収集
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

  // 3件未満の場合はデフォルト検索で補完
  if (products.length < 3) {
    const defaultResults = await executeSearch("ボンボンドロップシール", 3);
    for (const product of defaultResults) {
      if (products.length >= 3) break;
      if (!usedUrls.has(product.url)) {
        usedUrls.add(product.url);
        products.push({ ...product, keyword: "ボンボンドロップシール" });
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

  const amazonUrl = `https://www.amazon.co.jp/s?k=${encKey}&tag=${APP_CONFIG.affiliateIds.amazon}`;
  const rakutenUrl = `https://hb.afl.rakuten.co.jp/hgc/${APP_CONFIG.affiliateIds.rakuten}/?pc=${encodeURIComponent('https://search.rakuten.co.jp/search/mall/' + keyword)}`;
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
// 記事本文HTML生成
// =====================================
function generateArticleHtml(article, affiliateHtmlList) {
  const formattedTime = article.sightingTime || "不明";
  const cleanTweetUrl = article.sourceUrl.split('?')[0].replace('https://x.com', 'https://twitter.com');
  const mapQuery = encodeURIComponent(article.shopAddress || article.shopName);
  const mapEmbedUrl = `https://maps.google.co.jp/maps?output=embed&q=${mapQuery}&t=m&z=15`;

  const affiliate1 = affiliateHtmlList[0] || '';
  const affiliate2 = affiliateHtmlList[1] || '';
  const affiliate3 = affiliateHtmlList[2] || '';

  return `
<p>
    ${article.prefecture || "エリア不明"}${article.city ? article.city : ""}の「${article.shopName}」にて、${article.productName}の目撃情報があります！<br>
    ${article.statusText} お近くの方はチェックしてみる価値がありそうです。
</p>

${affiliate1}

<p><strong>📅 目撃・入荷時期</strong> ${formattedTime}</p>

<h3>📦 販売状況・詳細</h3>
<ul>
    <li><strong>内容:</strong> ${article.productName}が販売されていたとの報告あり。</li>
    <li><strong>注意:</strong> ${article.confidenceMemo || '情報の正確性は保証できません。'}</li>
</ul>

${affiliate2}

<h3>🔗 情報ソース（現地ポスト）</h3>
<figure class="wp-block-embed is-type-rich is-provider-twitter wp-block-embed-twitter">
    <div class="wp-block-embed__wrapper">
        ${cleanTweetUrl}
    </div>
</figure>

<h3>📍 店舗情報</h3>
<ul>
    <li><strong>店舗名:</strong> ${article.shopName}</li>
    <li><strong>住所:</strong> ${article.shopAddress || '不明'}</li>
</ul>

<div style="width: 100%; height: 350px; margin-top: 20px; margin-bottom: 40px;">
    <iframe
        width="100%"
        height="100%"
        frameborder="0"
        style="border:0; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);"
        src="${mapEmbedUrl}"
        allowfullscreen>
    </iframe>
</div>

${affiliate3}`;
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
  }

  async uploadImage(imagePath, tweetId) {
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
          'Content-Disposition': `attachment; filename="${tweetId}.png"`
        }
      });
      return response.data.id;
    } catch (error) {
      console.error(`  ❌ 画像アップロード失敗: ${error.message}`);
      console.error(`  📋 ステータス: ${error.response?.status}`);
      console.error(`  📋 詳細: ${JSON.stringify(error.response?.data || {})}`);
      console.error(`  📋 URL: ${this.apiUrl}/media`);
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
      return null;
    }
  }

  getCategoryIds(prefecture) {
    const ids = [WP_CATEGORY_MAP["都道府県別"] || 862];
    if (!prefecture) return ids;

    // 都道府県名から「都府県」を除去
    const cleanPref = prefecture.replace(/[都府県]$/, '');

    // 地方カテゴリを追加
    const regionId = PREF_TO_REGION_MAP[cleanPref];
    if (regionId) ids.push(regionId);

    // 都道府県カテゴリを追加
    const prefId = WP_CATEGORY_MAP[cleanPref];
    if (prefId) ids.push(prefId);

    return [...new Set(ids.filter(id => id != null))];
  }

  async postArticle(article) {
    // 画像アップロード
    const imagePath = article.imagePath ? path.join(process.cwd(), article.imagePath) : null;
    const mediaId = await this.uploadImage(imagePath, article.sourceTweetId);

    // アフィリエイト情報取得（3商品）
    const searchKeywords = [
      article.productName,
      "ボンボンドロップシール",
      "ぷっくりシール"
    ].filter(Boolean);
    const products = await fetchYahooProducts(searchKeywords);
    const affiliateHtmlList = products.map(p => generateAffiliateHtml(p.keyword, p));

    // カテゴリ・タグ
    const categories = this.getCategoryIds(article.prefecture);
    const tags = [];
    const tag1 = await this.getOrCreateTag("目撃速報");
    if (tag1) tags.push(tag1);
    if (article.productName) {
      const tag2 = await this.getOrCreateTag(article.productName);
      if (tag2) tags.push(tag2);
    }

    // スラッグ生成
    const prefRomaji = PREF_ROMAJI_MAP[article.prefecture] || "unknown";
    const englishCity = await getEnglishCityName(article.city);
    const dateStr = article.sightingTime ? article.sightingTime.substring(0, 10) : "unknown-date";
    const customSlug = `sight-info-${prefRomaji}-${englishCity}-${dateStr}`;

    // 投稿データ
    const payload = {
      title: `【目撃速報】${article.productName}｜${article.prefecture || ""}${article.city || ""}（${article.shopName}）`,
      content: generateArticleHtml(article, affiliateHtmlList),
      status: 'publish',
      slug: customSlug,
      categories: categories,
      tags: tags,
      acf: {
        shop_name: article.shopName,
        shop_address: article.shopAddress || "",
        location_name: article.city || "",
        source_url: article.sourceUrl
      }
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
      console.error(`  📋 ステータス: ${error.response?.status}`);
      console.error(`  📋 詳細: ${JSON.stringify(error.response?.data || {})}`);
      console.error(`  📋 URL: ${this.apiUrl}/posts`);
      return null;
    }
  }
}

// =====================================
// ファイル管理
// =====================================
function getArticlesFiles() {
  if (!fs.existsSync(APP_CONFIG.articlesDir)) {
    return [];
  }
  const files = fs.readdirSync(APP_CONFIG.articlesDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 3);
  return files.map(f => path.join(APP_CONFIG.articlesDir, f));
}

// =====================================
// メイン処理
// =====================================
async function main() {
  console.log('[WordPress] 記事投稿開始');

  const articlesFiles = getArticlesFiles();
  if (articlesFiles.length === 0) {
    console.log('[WordPress] 記事ファイルが見つかりません');
    return;
  }

  const wpService = new WordPressService();
  let totalPosted = 0;
  let totalSkipped = 0;

  for (const articlesFile of articlesFiles) {
    console.log(`[WordPress] 読み込み: ${articlesFile}`);

    const data = JSON.parse(fs.readFileSync(articlesFile, 'utf-8'));
    const articles = data.articles || [];

    let updated = false;

    for (const article of articles) {
      // isPostedがあればスキップ
      if (article.isPosted) {
        totalSkipped++;
        continue;
      }

      // imagePathがなければスキップ（画像生成待ち）
      if (!article.imagePath) {
        console.log(`  ⏭️ 画像未生成のためスキップ: ${article.sourceTweetId}`);
        continue;
      }

      const result = await wpService.postArticle(article);
      if (result?.id) {
        article.isPosted = true;
        article.wpPostId = result.id;
        article.wpPostUrl = result.link;
        article.postedAt = getNowJST();
        updated = true;
        totalPosted++;
        console.log(`  ✅ 投稿完了: ${result.link}`);
      }

      await new Promise(res => setTimeout(res, APP_CONFIG.waitMs));
    }

    // JSONファイル更新
    if (updated) {
      fs.writeFileSync(articlesFile, JSON.stringify(data, null, 2));
      console.log(`[WordPress] 更新: ${articlesFile}`);
    }
  }

  console.log('');
  console.log(`[WordPress] 完了: 投稿 ${totalPosted}件 / スキップ ${totalSkipped}件`);
}

main().catch(console.error);
