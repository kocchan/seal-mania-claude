/**
 * 目撃情報から画像を生成する
 *
 * 使い方:
 *   node scripts/sightings/generate-images.js
 *
 * 入力:
 *   output/sightings/articles/{日付}.json
 *
 * 出力:
 *   output/sightings/images/{tweetId}.png
 *
 * 機能:
 *   - 記事データから画像を生成
 *   - 都道府県・市区町村・店舗名を表示
 *   - 地域ごとに枠線の色を変更
 *   - 生成済み記事はimagePathフラグで管理
 */

import fs from 'fs';
import path from 'path';
import { createCanvas, registerFont } from 'canvas';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================
// 設定
// =====================================
const CONFIG = {
  // 画像サイズ（OGP推奨）
  width: 1200,
  height: 630,

  // デザイン
  borderWidth: 12,
  cornerRadius: 20,
  padding: 25,
  backgroundColor: '#FFFFFF',

  // フォント
  fontFamily: 'keifont',
  titleFontSize: 36,
  locationFontSize: 120,
  shopFontSize: 48,
  textColor: '#333333',

  // 入出力
  articlesDir: 'output/sightings/articles',
  imagesDir: 'output/sightings/images',
  fontsDir: 'assets/fonts'
};

// =====================================
// 地域カラー設定
// =====================================
const REGION_COLORS = {
  hokkaido_tohoku: '#4FC3F7', // 北海道・東北 (明るい水色)
  kanto: '#FF6699',           // 関東 (ポップなピンク)
  chubu: '#FF9800',           // 中部 (鮮やかなオレンジ)
  kinki: '#BA68C8',           // 近畿 (少し明るめの紫)
  chugoku_shikoku: '#4CAF50', // 中国・四国 (フラットな緑)
  kyushu_okinawa: '#EF5350'   // 九州・沖縄 (明るい赤)
};

// 都道府県→地域マッピング
const PREFECTURE_REGION = {
  // 北海道・東北
  '北海道': 'hokkaido_tohoku',
  '青森県': 'hokkaido_tohoku',
  '岩手県': 'hokkaido_tohoku',
  '宮城県': 'hokkaido_tohoku',
  '秋田県': 'hokkaido_tohoku',
  '山形県': 'hokkaido_tohoku',
  '福島県': 'hokkaido_tohoku',
  // 関東
  '茨城県': 'kanto',
  '栃木県': 'kanto',
  '群馬県': 'kanto',
  '埼玉県': 'kanto',
  '千葉県': 'kanto',
  '東京都': 'kanto',
  '神奈川県': 'kanto',
  // 中部
  '新潟県': 'chubu',
  '富山県': 'chubu',
  '石川県': 'chubu',
  '福井県': 'chubu',
  '山梨県': 'chubu',
  '長野県': 'chubu',
  '岐阜県': 'chubu',
  '静岡県': 'chubu',
  '愛知県': 'chubu',
  // 近畿
  '三重県': 'kinki',
  '滋賀県': 'kinki',
  '京都府': 'kinki',
  '大阪府': 'kinki',
  '兵庫県': 'kinki',
  '奈良県': 'kinki',
  '和歌山県': 'kinki',
  // 中国・四国
  '鳥取県': 'chugoku_shikoku',
  '島根県': 'chugoku_shikoku',
  '岡山県': 'chugoku_shikoku',
  '広島県': 'chugoku_shikoku',
  '山口県': 'chugoku_shikoku',
  '徳島県': 'chugoku_shikoku',
  '香川県': 'chugoku_shikoku',
  '愛媛県': 'chugoku_shikoku',
  '高知県': 'chugoku_shikoku',
  // 九州・沖縄
  '福岡県': 'kyushu_okinawa',
  '佐賀県': 'kyushu_okinawa',
  '長崎県': 'kyushu_okinawa',
  '熊本県': 'kyushu_okinawa',
  '大分県': 'kyushu_okinawa',
  '宮崎県': 'kyushu_okinawa',
  '鹿児島県': 'kyushu_okinawa',
  '沖縄県': 'kyushu_okinawa'
};

/**
 * 都道府県から枠線色を取得
 */
function getBorderColor(prefecture) {
  const region = PREFECTURE_REGION[prefecture];
  return region ? REGION_COLORS[region] : '#7FBFCF'; // デフォルト色
}

// =====================================
// 描画関数
// =====================================

/**
 * 背景（外枠 + 角丸の白い矩形）を描画
 */
function drawBackground(ctx, borderColor) {
  const { width, height, borderWidth, cornerRadius, padding, backgroundColor } = CONFIG;

  // 外枠（地域色）
  ctx.fillStyle = borderColor;
  ctx.fillRect(0, 0, width, height);

  // 内側の白い角丸矩形
  const innerX = borderWidth + padding;
  const innerY = borderWidth + padding;
  const innerWidth = width - (borderWidth + padding) * 2;
  const innerHeight = height - (borderWidth + padding) * 2;

  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.roundRect(innerX, innerY, innerWidth, innerHeight, cornerRadius);
  ctx.fill();
}

/**
 * テキストを描画
 */
function drawText(ctx, title, location, shopName) {
  const { width, height, fontFamily, titleFontSize, locationFontSize, shopFontSize, textColor } = CONFIG;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;

  // タイトル（上部・小さめ）「ボンボンドロップシール目撃情報」
  ctx.font = `${titleFontSize}px "${fontFamily}"`;
  ctx.fillText(title, width / 2, height * 0.22);

  // 地名（中央・大きめ）「山口県・防府市」
  ctx.font = `${locationFontSize}px "${fontFamily}"`;
  ctx.fillText(location, width / 2, height * 0.52);

  // 店舗名（下部）
  if (shopName) {
    ctx.font = `${shopFontSize}px "${fontFamily}"`;
    ctx.fillText(shopName, width / 2, height * 0.80);
  }
}

/**
 * 画像を生成
 */
function createImage(article, outputPath) {
  const { width, height } = CONFIG;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 地域に応じた枠線色
  const borderColor = getBorderColor(article.prefecture);

  // タイトルと地名を生成
  const title = 'ボンボンドロップシール目撃情報';
  const location = `${article.prefecture}・${article.city}`;
  const shopName = article.shopName || '';

  // 描画
  drawBackground(ctx, borderColor);
  drawText(ctx, title, location, shopName);

  // 保存
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
}

// =====================================
// ファイル管理
// =====================================

/**
 * 直近の記事ファイルを取得（複数）
 */
function getArticlesFiles() {
  if (!fs.existsSync(CONFIG.articlesDir)) {
    return [];
  }

  const files = fs.readdirSync(CONFIG.articlesDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, 3); // 直近3日分

  return files.map(f => path.join(CONFIG.articlesDir, f));
}

// =====================================
// メイン処理
// =====================================
async function main() {
  console.log('[Images] 画像生成開始');

  // フォント登録
  const fontPath = path.join(process.cwd(), CONFIG.fontsDir, 'keifont.ttf');
  if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: CONFIG.fontFamily });
    console.log('[Images] フォント登録: keifont.ttf');
  } else {
    console.warn(`[Images] 警告: フォントが見つかりません: ${fontPath}`);
    console.warn('[Images] システムフォントを使用します');
  }

  // 記事ファイルを取得
  const articlesFiles = getArticlesFiles();
  if (articlesFiles.length === 0) {
    console.log('[Images] 記事ファイルが見つかりません');
    return;
  }

  // 出力ディレクトリ作成
  fs.mkdirSync(CONFIG.imagesDir, { recursive: true });

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const articlesFile of articlesFiles) {
    console.log(`[Images] 読み込み: ${articlesFile}`);

    const data = JSON.parse(fs.readFileSync(articlesFile, 'utf-8'));
    const articles = data.articles || [];

    if (articles.length === 0) {
      continue;
    }

    let generated = 0;
    let skipped = 0;
    let updated = false;

    for (const article of articles) {
      const tweetId = article.sourceTweetId;
      if (!tweetId) {
        console.warn('[Images] sourceTweetIdがない記事をスキップ');
        continue;
      }

      // imagePathがあればスキップ
      if (article.imagePath) {
        skipped++;
        continue;
      }

      const filename = `${tweetId}.png`;
      const outputPath = path.join(CONFIG.imagesDir, filename);

      try {
        createImage(article, outputPath);
        // 記事にimagePathを追加
        article.imagePath = `${CONFIG.imagesDir}/${filename}`;
        updated = true;
        generated++;
        process.stdout.write('.');
      } catch (e) {
        console.error(`\n[Images] エラー (${tweetId}):`, e.message);
      }
    }

    // JSONファイルを更新
    if (updated) {
      fs.writeFileSync(articlesFile, JSON.stringify(data, null, 2));
      console.log(`\n[Images] 更新: ${articlesFile}`);
    }

    totalGenerated += generated;
    totalSkipped += skipped;
  }

  console.log('');
  console.log(`[Images] 完了: 生成 ${totalGenerated}件 / スキップ ${totalSkipped}件`);
}

main().catch(console.error);
