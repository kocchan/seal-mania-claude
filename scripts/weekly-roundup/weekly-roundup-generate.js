/**
 * 目撃情報 週間まとめ記事生成スクリプト
 *
 * 過去7日分の目撃情報を都道府県別に集約し、
 * 「地区別の攻略法」を含む記事markdownを生成する。
 *
 * 主な機能:
 *   - 都道府県内の市区町村を Gemini AI で人が認識しやすいエリアにグループ化
 *   - 各エリアごとに「注目店舗」「攻略法（時間帯・曜日・在庫傾向）」「タイムライン」を生成
 *   - 冒頭に Google Static Maps API の全店舗ピン付き地図を埋め込み
 *
 * 使い方:
 *   node scripts/sightings/generate-weekly-roundup.js --week-start 2026-05-04
 */

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { geocodeAddress, buildStaticMapUrl, buildSearchMapUrl, buildEmbedMapUrl } from './weekly-roundup-geocode.js';
import { fetchYahooProducts, generateAffiliateHtml } from './weekly-roundup-affiliate.js';

const ARTICLES_DIR = 'output/sightings/articles';
const OUTPUT_DIR = 'output/weekly-roundup';
const AREA_CACHE_PATH = 'output/weekly-roundup/area-groups-cache.json';
const DEFAULT_THRESHOLD = 5;

// =====================================
// 都道府県ローマ字
// =====================================
const PREF_ROMAJI_MAP = {
  "北海道": "hokkaido",
  "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita",
  "山形県": "yamagata", "福島県": "fukushima",
  "茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama",
  "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa",
  "新潟県": "niigata", "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui",
  "山梨県": "yamanashi", "長野県": "nagano", "岐阜県": "gifu", "静岡県": "shizuoka",
  "愛知県": "aichi",
  "三重県": "mie", "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka",
  "兵庫県": "hyogo", "奈良県": "nara", "和歌山県": "wakayama",
  "鳥取県": "tottori", "島根県": "shimane", "岡山県": "okayama", "広島県": "hiroshima",
  "山口県": "yamaguchi", "徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime",
  "高知県": "kochi",
  "福岡県": "fukuoka", "佐賀県": "saga", "長崎県": "nagasaki", "熊本県": "kumamoto",
  "大分県": "oita", "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa"
};

const PREF_NORMALIZE = {};
Object.keys(PREF_ROMAJI_MAP).forEach(full => {
  PREF_NORMALIZE[full] = full;
  PREF_NORMALIZE[full.replace(/(都|道|府|県)$/, '')] = full;
});

// =====================================
// Gemini クライアント
// =====================================
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const textModel = genAI?.getGenerativeModel({ model: 'gemini-2.5-flash' });

// =====================================
// 引数
// =====================================
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { weekStart: null, threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week-start' && args[i + 1]) out.weekStart = args[++i];
    if (args[i] === '--threshold' && args[i + 1]) out.threshold = parseInt(args[++i], 10);
  }
  return out;
}

// =====================================
// 日付ユーティリティ
// =====================================
function defaultPreviousMonday(today = new Date()) {
  const jstNow = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const dow = jstNow.getUTCDay();
  const daysSincePrevMonday = dow === 1 ? 7 : (dow === 0 ? 6 : dow - 1);
  return formatDate(new Date(jstNow.getTime() - daysSincePrevMonday * 24 * 60 * 60 * 1000));
}
function formatDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function addDays(yyyymmdd, days) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return formatDate(dt);
}
function weekLabel(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const monthFirst = new Date(Date.UTC(y, m - 1, 1));
  const dow = monthFirst.getUTCDay();
  const monthFirstMonday = (dow === 1) ? 1 : (dow === 0 ? 2 : 9 - dow);
  const wn = Math.floor((d - monthFirstMonday) / 7) + 1;
  return `${y}年${m}月${['第1週', '第2週', '第3週', '第4週', '第5週'][Math.max(0, Math.min(4, wn - 1))]}`;
}
function formatDayLabel(yyyymmdd) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${m}/${d}（${['日', '月', '火', '水', '木', '金', '土'][dt.getUTCDay()]}）`;
}

// =====================================
// 記事ロード
// =====================================
function loadArticles(weekStart, weekEnd) {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.json')).sort();
  const collected = [];
  for (const f of files) {
    const dateStr = f.replace('.json', '');
    if (dateStr < addDays(weekStart, -1) || dateStr > addDays(weekEnd, 1)) continue;
    const data = JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf-8'));
    const arr = Array.isArray(data) ? data : (data.articles || []);
    collected.push(...arr);
  }
  return collected.filter(a => {
    const t = a.sightingTime || a.postedAt || '';
    const day = t.substring(0, 10);
    return day >= weekStart && day <= weekEnd;
  });
}

function groupByPrefecture(articles, threshold) {
  const groups = {};
  for (const a of articles) {
    if (!a.prefecture) continue;
    const norm = PREF_NORMALIZE[a.prefecture] || a.prefecture;
    if (!PREF_ROMAJI_MAP[norm]) continue;
    if (!groups[norm]) groups[norm] = [];
    groups[norm].push(a);
  }
  return Object.entries(groups)
    .filter(([, list]) => list.length >= threshold)
    .sort((a, b) => b[1].length - a[1].length);
}

// =====================================
// エリアグループ化（Gemini + キャッシュ）
// =====================================
function loadAreaCache() {
  if (fs.existsSync(AREA_CACHE_PATH)) {
    try { return JSON.parse(fs.readFileSync(AREA_CACHE_PATH, 'utf-8')); } catch { return {}; }
  }
  return {};
}
function saveAreaCache(cache) {
  fs.mkdirSync(path.dirname(AREA_CACHE_PATH), { recursive: true });
  fs.writeFileSync(AREA_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function groupCitiesIntoAreas(prefName, cities) {
  const cache = loadAreaCache();
  const cacheKey = `${prefName}::${[...cities].sort().join(',')}`;
  if (cache[cacheKey]) return cache[cacheKey];

  // Gemini なしの場合フォールバック: 全部「{県名}全域」
  if (!textModel || cities.length === 0) {
    const fallback = { [`${prefName}全域`]: cities };
    cache[cacheKey] = fallback;
    saveAreaCache(cache);
    return fallback;
  }

  const prompt = `あなたは日本の地理に詳しいエキスパートです。
都道府県「${prefName}」の以下の市区町村を、人が認識しやすい商業エリア・地域グループにまとめてください。

入力市区町村: ${cities.join(', ')}

要件:
- グループ名は地名や通称（例: 「渋谷・原宿エリア」「秋葉原・神田エリア」「大阪市中心部」）
- 隣接する/近接する市区町村は同じグループにする
- 1グループあたり1〜4市区町村程度
- 入力された市区町村だけを使う（追加しない、漏らさない）

出力形式（JSON のみ、説明文や \`\`\` 不要）:
{
  "エリア名1": ["市区町村1", "市区町村2"],
  "エリア名2": ["市区町村3"]
}`;

  try {
    const result = await textModel.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON not found');
    const parsed = JSON.parse(jsonMatch[0]);
    // 入力に含まれない市区町村が混入していないか軽くチェック → 含まれていれば「その他」へ
    const used = new Set(Object.values(parsed).flat());
    const missing = cities.filter(c => !used.has(c));
    if (missing.length > 0) {
      parsed['その他エリア'] = (parsed['その他エリア'] || []).concat(missing);
    }
    cache[cacheKey] = parsed;
    saveAreaCache(cache);
    return parsed;
  } catch (e) {
    console.warn(`[areaGroup] Gemini失敗 (${prefName}): ${e.message}. フォールバック適用`);
    const fallback = { [`${prefName}全域`]: cities };
    cache[cacheKey] = fallback;
    saveAreaCache(cache);
    return fallback;
  }
}

// =====================================
// 攻略法情報の算出
// =====================================
function analyzeArticles(articles) {
  // 時間帯ヒストグラム
  const hourBuckets = Array.from({ length: 24 }, () => 0);
  // 曜日別件数（0=日)
  const dowBuckets = Array.from({ length: 7 }, () => 0);
  // ステータスキーワード
  const statusKeywords = { '入荷': 0, '在庫あり': 0, '再入荷': 0, '売り切れ': 0, '行列': 0, '完売': 0, '少量': 0 };
  // 注意点抽出
  const cautionMentions = [];
  // 商品ランキング
  const products = {};
  // 店舗ランキング
  const shops = {};

  for (const a of articles) {
    const t = a.sightingTime || a.postedAt || '';
    if (t.length >= 13) {
      const h = parseInt(t.substring(11, 13), 10);
      if (!isNaN(h) && h >= 0 && h < 24) hourBuckets[h]++;
    }
    if (t.length >= 10) {
      const [y, m, d] = t.substring(0, 10).split('-').map(Number);
      if (y && m && d) {
        const dt = new Date(Date.UTC(y, m - 1, d));
        dowBuckets[dt.getUTCDay()]++;
      }
    }
    const status = a.statusText || '';
    for (const k of Object.keys(statusKeywords)) {
      if (status.includes(k)) statusKeywords[k]++;
    }
    if (/制限|お一人様|条件|限定|並んで|抽選|ポイントカード/.test(status)) {
      cautionMentions.push({ shop: a.shopName || '不明', status: status.substring(0, 60) });
    }
    const productName = a.productName || 'ボンボンドロップシール';
    products[productName] = (products[productName] || 0) + 1;

    const shop = a.shopName || '不明な店舗';
    if (!shops[shop]) shops[shop] = { count: 0, city: a.city, address: a.shopAddress, latest: '', latestArticle: a };
    shops[shop].count++;
    if (t > shops[shop].latest) {
      shops[shop].latest = t;
      shops[shop].latestArticle = a;
    }
  }

  // 狙い目時間帯: 「在庫あり/入荷/買えた/あった」報告 かつ 店舗営業時間内（10-21時）の3時間窓
  const inStockHours = Array.from({ length: 24 }, () => 0);
  for (const a of articles) {
    const t = a.sightingTime || a.postedAt || '';
    const status = a.statusText || '';
    if (!/在庫あり|入荷|買えた|あった|残ってる|残ってた|まだあり/.test(status)) continue;
    if (t.length >= 13) {
      const h = parseInt(t.substring(11, 13), 10);
      if (!isNaN(h) && h >= 10 && h < 22) inStockHours[h]++;
    }
  }
  let bestStart = 10, bestSum = 0;
  for (let i = 10; i <= 19; i++) {
    const sum = inStockHours[i] + inStockHours[i + 1] + inStockHours[i + 2];
    if (sum > bestSum) { bestSum = sum; bestStart = i; }
  }
  const peakRange = bestSum > 0 ? `${bestStart}〜${bestStart + 3}時` : '営業時間内（10〜21時推奨）';

  // 曜日ピーク
  const dows = ['日', '月', '火', '水', '木', '金', '土'];
  const dowMax = Math.max(...dowBuckets);
  const peakDow = dowMax > 0 ? dows[dowBuckets.indexOf(dowMax)] : '不明';
  const dowText = dowBuckets.map((c, i) => `${dows[i]}:${c}`).join(' / ');

  return {
    hourBuckets, peakRange,
    dowBuckets, peakDow, dowText, dowMax,
    statusKeywords,
    cautionMentions: cautionMentions.slice(0, 3),
    productRanking: Object.entries(products).sort((a, b) => b[1] - a[1]).slice(0, 3),
    shopRanking: Object.entries(shops).sort((a, b) => b[1].count - a[1].count)
  };
}

// =====================================
// markdown生成
// =====================================
async function generateMarkdownForPrefecture({ pref, articles, weekStart, weekEnd, allGroups, areaGroups, geocodeMap, mapUrl }) {
  const romaji = PREF_ROMAJI_MAP[pref];
  const count = articles.length;
  const label = weekLabel(weekStart);
  // slugは都道府県ごとに固定（週ごとには変えず、同じURLを毎週上書き更新）
  const slug = `sight-info-weekly-${romaji}`;
  const title = `【${label}】${pref}のボンボンドロップシール目撃まとめ｜全${count}件・地区別攻略法`;
  const description = `${weekStart}〜${weekEnd}の1週間で${pref}に寄せられたボンボンドロップシール目撃情報を地区別にまとめ、各地区の狙い目時間帯や注目店舗、攻略法を紹介。`;

  const allAnalysis = analyzeArticles(articles);
  const includedSightingIds = articles.filter(a => a.wpPostId).map(a => a.wpPostId);

  // 店舗ユニーク数（サマリー用）
  const uniqueShops = [];
  const seenShops = new Set();
  for (const a of articles) {
    const key = a.shopName || '';
    if (!seenShops.has(key) && a.shopName) {
      seenShops.add(key);
      uniqueShops.push(a);
    }
  }

  // 県全体サマリー（文章で簡潔に）
  const peakStatus = Object.entries(allAnalysis.statusKeywords).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])[0];
  const summaryBlock = `今週（${weekStart}〜${weekEnd}）、${pref}では**${count}件**の目撃情報が**${uniqueShops.length}店舗**から寄せられました。最も賑わったのは**${allAnalysis.peakDow}曜日**で、${allAnalysis.peakRange}帯に在庫情報が多く集まっています${peakStatus ? `。「${peakStatus[0]}」の報告が${peakStatus[1]}件と最も多く、入手のチャンスが広がっている一週間でした` : ''}。

`;

  // 県全体マップは廃止（小さくて見えないため、エリアごとに埋め込みマップを表示）
  const mapSection = '';

  // エリアごとのセクション
  const areaSections = [];
  for (const [areaName, cityList] of Object.entries(areaGroups)) {
    const areaArticles = articles.filter(a => cityList.includes(a.city));
    if (areaArticles.length === 0) continue;
    const a = analyzeArticles(areaArticles);

    // 注目店舗（このエリア内）
    const topShops = a.shopRanking.slice(0, 5);
    const shopRows = topShops.map(([name, info], i) => {
      const addrEnc = encodeURIComponent(info.address || `${pref} ${name}`);
      const mapLink = `[🗺地図](https://www.google.com/maps/search/?api=1&query=${addrEnc})`;
      const articleUrl = getPostUrl(info.latestArticle);
      const articleLink = articleUrl ? `[📖記事](${articleUrl})` : '';
      const links = [articleLink, mapLink].filter(Boolean).join(' / ');
      return `| ${i + 1}位 | ${name} | ${info.city || '-'} | ${info.count}回 | ${info.latest.substring(11, 16) || '--:--'} | ${links} |`;
    }).join('\n');

    // 攻略法
    const statusEntries = Object.entries(a.statusKeywords).filter(([, c]) => c > 0).sort((x, y) => y[1] - x[1]);
    const statusText = statusEntries.length > 0 ? statusEntries.map(([k, c]) => `${k}: ${c}件`).join(' / ') : '報告なし';
    const productText = a.productRanking.map(([name, c]) => `${name} (${c}件)`).join(' / ');
    const cautionText = a.cautionMentions.length > 0
      ? a.cautionMentions.map(c => `- ${c.shop}: ${c.status}`).join('\n')
      : '- 特になし';

    // アフィリエイト（地区ごと3件）
    console.log(`  💰 アフィリエイト取得: ${areaName}`);
    const topProducts = a.productRanking.map(([n]) => n).filter(n => n && n !== 'ボンボンドロップシール');
    const affKeywords = [
      ...topProducts.slice(0, 2).map(p => `ボンボンドロップシール ${p}`),
      'ボンボンドロップシール',
      'ぷっくりシール'
    ];
    const products = await fetchYahooProducts(affKeywords, 3);
    const affiliateBlock = products.length > 0
      ? `\n### 🛒 ${areaName}でおすすめのボンボンドロップシール商品\n\n` +
        products.map(p => generateAffiliateHtml(p.keyword, p)).join('\n')
      : '';

    // エリア内の店舗の中心点（ジオコード結果）
    const areaShopNames = topShops.map(([n]) => n);
    const areaCoords = areaShopNames
      .map(n => geocodeMap[n])
      .filter(Boolean);
    const center = areaCoords.length > 0
      ? {
          lat: areaCoords.reduce((s, p) => s + p.lat, 0) / areaCoords.length,
          lng: areaCoords.reduce((s, p) => s + p.lng, 0) / areaCoords.length
        }
      : null;
    // 埋め込みマップ（iframe）— 店舗名を含む検索でピンを表示、タップで店舗名表示
    const embedMapUrl = buildEmbedMapUrl({
      prefName: pref, areaName, shopNames: areaShopNames, center, zoom: 14
    });
    const embedMapBlock = embedMapUrl
      ? `<iframe src="${embedMapUrl}" width="100%" height="380" style="border:0; border-radius:8px; margin:16px 0;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
      : '';

    // 攻略法（文章化）
    const topShopName = topShops[0]?.[0] || null;
    const topShopCount = topShops[0]?.[1]?.count || 0;
    const topProductName = a.productRanking[0]?.[0] || null;
    const inStockCount = (a.statusKeywords['入荷'] || 0) + (a.statusKeywords['在庫あり'] || 0) + (a.statusKeywords['再入荷'] || 0);
    const soldOutCount = (a.statusKeywords['売り切れ'] || 0) + (a.statusKeywords['完売'] || 0);

    const strategyParas = [];
    strategyParas.push(`**${areaName}**では今週**${areaArticles.length}件**の目撃情報が寄せられました。最も賑わったのは**${a.peakDow}曜日（${a.dowMax}件）**で、時間帯では**${a.peakRange}**頃に「在庫あり」「入荷」の報告が集中しています。この時間帯を狙って訪れるのがおすすめです。`);

    if (inStockCount > 0 || soldOutCount > 0) {
      const stockLine = [];
      if (inStockCount > 0) stockLine.push(`「入荷・在庫あり」系の報告が**${inStockCount}件**`);
      if (soldOutCount > 0) stockLine.push(`「売り切れ」系の報告が**${soldOutCount}件**`);
      strategyParas.push(`在庫の傾向としては、${stockLine.join('、')}寄せられています。${inStockCount > soldOutCount ? '比較的入手しやすい状況といえそうです。' : '在庫の動きが速いので、見つけたら即決をおすすめします。'}`);
    }

    if (topShopName && topShopCount >= 2) {
      strategyParas.push(`特に注目したいのは**${topShopName}**で、今週**${topShopCount}回**の目撃情報があり在庫が安定している可能性があります。`);
    }

    if (topProductName) {
      strategyParas.push(`このエリアで人気が高かったのは**${topProductName}**${a.productRanking[1]?.[0] ? `や**${a.productRanking[1][0]}**` : ''}です。`);
    }

    const strategyText = strategyParas.join('\n\n');

    areaSections.push(`---

## 📍 ${areaName}（${areaArticles.length}件）

${cityList.length > 0 ? `**含まれる市区町村**: ${cityList.join('、')}\n\n` : ''}
${embedMapBlock}

### 🏪 ${areaName}の注目店舗

複数回目撃された店舗から優先表示しています（在庫が安定している可能性あり）。各店の📖アイコンから元の目撃記事に飛べます。

| 順位 | 店舗名 | 市区町村 | 報告数 | 最終目撃時刻 | リンク |
|------|--------|----------|--------|-------------|--------|
${shopRows || '| - | (集計対象なし) | - | - | - | - |'}

### 🎯 ${areaName}の攻略法

${strategyText}

#### ⚠️ 購入時の注意点

${cautionText}
${affiliateBlock}
`);
  }

  // 関連エリア（他県）
  const relatedList = allGroups
    .filter(([p]) => p !== pref)
    .slice(0, 5)
    .map(([p, list]) => {
      const r = PREF_ROMAJI_MAP[p];
      return `- [${p}（${list.length}件）](sight-info-weekly-${r}/)`;
    })
    .join('\n');

  // フロントマター
  const frontmatter = `---
type: weekly-roundup
prefecture: "${pref}"
prefRomaji: ${romaji}
weekStart: "${weekStart}"
weekEnd: "${weekEnd}"
totalCount: ${count}
imageGenerated: false
posted: false
slug: "${slug}"
title: "${title}"
description: "${description}"
includedSightingIds: [${includedSightingIds.join(', ')}]
createdAt: "${new Date().toISOString()}"
---

`;

  // 本文
  const body = `# ${title}

${summaryBlock}
このページでは、${pref}を**地区ごとにグループ化**し、各地区の**注目店舗・狙い目時間帯・攻略法**をまとめています。マップ上のピンをタップすると店舗名が確認できます。お近くの地区の項目をチェックして、効率的に在庫を見つけてください！

${areaSections.join('\n')}

## 🔗 関連エリア（同週の他県まとめ）

${relatedList || '- (他に該当県なし)'}

## まとめ

${pref}の今週の目撃情報、参考になりましたか？このサイトでは毎週月曜日に都道府県別の目撃まとめを更新しています。

新しい目撃情報を見つけたら、X（旧Twitter）で「ボンボンドロップシール 入荷」などのキーワードでつぶやくと、こちらでも収集対象になります。来週もぜひチェックしてください！
`;

  return { content: frontmatter + body, slug, romaji };
}

// =====================================
// 個別記事URL
// =====================================
function getPostUrl(article) {
  if (article.wpPostUrl) return article.wpPostUrl;
  if (article.wpPostId) {
    const root = (process.env.WP_API_URL || '').replace(/\/wp-json\/.*$/, '');
    return root ? `${root}/?p=${article.wpPostId}` : null;
  }
  return null;
}

// =====================================
// メイン処理
// =====================================
async function main() {
  const args = parseArgs();
  const weekStart = args.weekStart || defaultPreviousMonday();
  const weekEnd = addDays(weekStart, 6);

  console.log(`[WeeklyRoundup] 集計期間: ${weekStart} 〜 ${weekEnd}（閾値: ${args.threshold}件以上）`);

  const articles = loadArticles(weekStart, weekEnd);
  console.log(`[WeeklyRoundup] 期間内: ${articles.length}件`);

  const groups = groupByPrefecture(articles, args.threshold);
  console.log(`[WeeklyRoundup] 対象都道府県: ${groups.length}件`);
  groups.forEach(([p, l]) => console.log(`  - ${p}: ${l.length}件`));

  if (groups.length === 0) return;

  const outDir = path.join(OUTPUT_DIR, weekStart);
  fs.mkdirSync(outDir, { recursive: true });

  let generated = 0;
  for (const [pref, list] of groups) {
    console.log(`\n=== ${pref} ===`);

    // 1. ジオコーディング（unique shopAddress）
    const uniqueShops = [];
    const seenShop = new Set();
    for (const a of list) {
      if (a.shopName && !seenShop.has(a.shopName)) {
        seenShop.add(a.shopName);
        uniqueShops.push(a);
      }
    }
    console.log(`  店舗ジオコーディング: ${uniqueShops.length}件`);
    const geocodeMap = {};
    const pins = [];
    for (const a of uniqueShops) {
      const addr = a.shopAddress || `${pref} ${a.shopName}`;
      const r = await geocodeAddress(addr);
      if (r) {
        geocodeMap[a.shopName] = r;
        pins.push({ lat: r.lat, lng: r.lng });
      }
    }
    console.log(`  ジオコーディング成功: ${pins.length}/${uniqueShops.length}`);

    // 2. Static Maps URL
    const mapUrl = pins.length > 0 ? buildStaticMapUrl(pins, { width: 800, height: 450 }) : null;

    // 3. エリアグループ化（Gemini）
    const cities = [...new Set(list.map(a => a.city).filter(Boolean))];
    console.log(`  市区町村: ${cities.length}個 → エリアグループ化中...`);
    const areaGroups = await groupCitiesIntoAreas(pref, cities);
    console.log(`  エリア数: ${Object.keys(areaGroups).length}`);

    // 4. md生成（アフィリエイト取得を含むのでawait）
    const { content, slug, romaji } = await generateMarkdownForPrefecture({
      pref, articles: list, weekStart, weekEnd, allGroups: groups, areaGroups, geocodeMap, mapUrl
    });

    // 既存画像がある場合は imageGenerated: true で書き出す（再生成を防ぐ）
    const existingImagePath = path.join(outDir, `${romaji}.png`);
    let finalContent = content;
    if (fs.existsSync(existingImagePath)) {
      finalContent = content.replace(/^imageGenerated:\s*false$/m, 'imageGenerated: true');
      console.log(`  ✓ 既存画像あり、imageGenerated: true に設定`);
    }

    const filePath = path.join(outDir, `${romaji}.md`);
    fs.writeFileSync(filePath, finalContent, 'utf-8');
    console.log(`  ✓ ${filePath}`);
    generated++;
  }

  console.log(`\n[WeeklyRoundup] 完了: ${generated}件のmd生成`);
  console.log(`保存先: ${outDir}/`);
}

main().catch(err => {
  console.error('[WeeklyRoundup] エラー:', err);
  process.exit(1);
});
