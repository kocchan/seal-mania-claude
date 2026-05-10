/**
 * アフィリエイト共通モジュール
 *
 * Yahoo!ショッピングAPIで商品検索 → Amazon/楽天/Yahoo!アフィリエイトHTML生成
 *
 * 使い方:
 *   import { fetchYahooProducts, generateAffiliateHtml } from './affiliate.js';
 *   const products = await fetchYahooProducts(['ボンボンドロップシール スティッチ']);
 *   const html = generateAffiliateHtml(products[0].keyword, products[0]);
 */

import axios from 'axios';

const AFFILIATE_IDS = {
  amazon: process.env.AMAZON_ASSOCIATE_ID,
  rakuten: process.env.RAKUTEN_AFFILIATE_ID
};
const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID;

// =====================================
// Yahoo!ショッピング検索（複数商品取得）
// =====================================
export async function fetchYahooProducts(keywords, maxItems = 3) {
  if (!YAHOO_CLIENT_ID) return [];

  const executeSearch = async (query, count = 3, attempt = 1) => {
    try {
      console.log(`  🔎 Yahoo API: ${query}${attempt > 1 ? ` (retry ${attempt})` : ''}`);
      const response = await axios.get('https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch', {
        params: {
          appid: YAHOO_CLIENT_ID,
          query: query,
          results: count,
          sort: '-score',
          image_size: 300
        }
      });
      const hits = response.data.hits;
      if (hits && hits.length > 0) {
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
      const status = e.response?.status;
      // 429 はレート制限。指数バックオフで最大3回リトライ
      if (status === 429 && attempt < 3) {
        const wait = 1000 * Math.pow(2, attempt); // 2s, 4s
        console.warn(`  ⏳ Yahoo 429 (rate limit). ${wait}ms 待機して再試行 (${attempt}/3)...`);
        await new Promise(r => setTimeout(r, wait));
        return executeSearch(query, count, attempt + 1);
      }
      console.error(`  ⚠️ Yahoo APIエラー: ${status || e.message}`);
      return [];
    }
  };

  const products = [];
  const usedUrls = new Set();

  for (const keyword of keywords) {
    if (products.length >= maxItems) break;
    const results = await executeSearch(keyword, maxItems);
    for (const product of results) {
      if (products.length >= maxItems) break;
      if (!usedUrls.has(product.url)) {
        usedUrls.add(product.url);
        products.push({ ...product, keyword });
      }
    }
    // 連続呼出しを抑える（無料枠のレート制限対策）
    await new Promise(r => setTimeout(r, 300));
  }

  if (products.length < maxItems) {
    const defaultResults = await executeSearch('ボンボンドロップシール', maxItems);
    for (const product of defaultResults) {
      if (products.length >= maxItems) break;
      if (!usedUrls.has(product.url)) {
        usedUrls.add(product.url);
        products.push({ ...product, keyword: 'ボンボンドロップシール' });
      }
    }
  }

  return products;
}

// =====================================
// アフィリエイトHTML生成（1商品分）
// =====================================
export function generateAffiliateHtml(keyword, productData) {
  if (!keyword) return '';

  const itemName = productData ? productData.name : keyword;
  const itemImage = (productData && productData.image) ? productData.image : 'https://placehold.jp/300x300.png?text=No%20Image';
  const itemPrice = productData ? `¥${productData.price.toLocaleString()}〜` : '';
  const encKey = encodeURIComponent(keyword);

  const amazonUrl = `https://www.amazon.co.jp/s?k=${encKey}&tag=${AFFILIATE_IDS.amazon}`;
  const rakutenUrl = `https://hb.afl.rakuten.co.jp/hgc/${AFFILIATE_IDS.rakuten}/?pc=${encodeURIComponent('https://search.rakuten.co.jp/search/mall/' + keyword)}`;
  const yahooSearchUrl = `https://shopping.yahoo.co.jp/search?p=${encKey}`;
  const mainLinkUrl = productData ? productData.url : yahooSearchUrl;

  return `
<div style="border: 2px solid #f2f2f2; border-radius: 4px; padding: 15px; margin: 20px 0; background: #fff; display: flex; flex-wrap: wrap; align-items: center; gap: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); width: 100%; box-sizing: border-box;">
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
