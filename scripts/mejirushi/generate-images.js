/**
 * めじるしアクセサリー新作記事のアイキャッチ画像を生成する（Gemini AI使用）
 * （scripts/lotteryinfo/generate-images.js の複製・めじるし向け調整版）
 *
 * 使い方:
 *   node scripts/mejirushi/generate-images.js
 *
 * 入力:
 *   output/mejirushi/drafts/{date}/{slug}.md
 *
 * 出力:
 *   output/mejirushi/images/{date}/{slug}.png
 *
 * 機能:
 *   - Gemini AIでチャーム/ガチャをテーマにした手描き風アイキャッチを生成
 *   - 生成済み記事はimageGeneratedフラグで管理（冪等）
 *   - 生成失敗しても投稿は止めない（post側がog:image→なしへフォールバック）
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// =====================================
// 設定
// =====================================
const CONFIG = {
  draftsDir: 'output/mejirushi/drafts',
  imagesDir: 'output/mejirushi/images'
};

// Gemini API クライアントの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 画像生成モデル
const imageModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-image-preview',
  generationConfig: {
    responseModalities: ['IMAGE']
  }
});

// =====================================
// frontmatter パーサー（簡易）
// =====================================
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  const frontmatter = {};
  let currentArray = null;

  for (const line of frontmatterStr.split('\n')) {
    if (line.match(/^\s+-\s+/) && currentArray) {
      currentArray.push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === '') {
        frontmatter[key] = [];
        currentArray = frontmatter[key];
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
        currentArray = null;
      }
    }
  }

  return { frontmatter, body };
}

// =====================================
// プロンプト生成（めじるしアクセサリー向け）
// =====================================

// 著作権配慮：実在キャラ名は直接描かせず、ジェネリックなかわいいモチーフに変換する
const COPYRIGHT_SAFE_THEMES = {
  'サンリオ': 'cute pastel animal mascots (a white kitten with a ribbon vibe, a soft pink bunny vibe) as generic kawaii characters',
  'ちいかわ': 'small round chubby white hamster-like generic kawaii creatures',
  'すみっコぐらし': 'shy round pastel creatures sitting in a corner, generic kawaii style',
  'ディズニー': 'generic magical fantasy motifs (castle silhouette, stars, sparkles) without any branded characters',
  'クレヨンしんちゃん': 'playful generic kindergarten kid doodle motifs',
  'mofusand': 'generic fluffy kittens in costumes, kawaii style'
};

function buildPrompt(frontmatter) {
  const title = frontmatter.title || '';
  const brand = frontmatter.brand || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const salesDate = frontmatter.salesDate || '';
  const price = frontmatter.priceRange || '';

  // タグ・ブランドからテーマを決定（著作権セーフ変換）
  let theme = 'colorful generic kawaii animal mascots';
  for (const [key, safeTheme] of Object.entries(COPYRIGHT_SAFE_THEMES)) {
    if (brand.includes(key) || tags.some(t => t.includes(key))) {
      theme = safeTheme;
      break;
    }
  }

  // 発売月の表示（「7月」など）
  let monthLabel = '';
  const m = salesDate.match(/^\d{4}-(\d{2})/);
  if (m) monthLabel = `${parseInt(m[1])}月`;

  return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article about a new capsule-toy charm release in Japan.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: Soft pastel colors (light pink, light lavender, or mint) with subtle patterns like tiny dots or sparkles.

**[Main Elements]**
1. **Product Illustration**: Draw cute small "めじるしアクセサリー" charms — tiny mascot charms with a small clear ring/clip on top, the kind you attach to umbrellas, water bottles and bag zippers. Show 3-5 charms clipped onto an umbrella handle and a pastel water bottle.
2. **Gacha Machine**: Include a cute round capsule-toy vending machine (gashapon) with colorful capsules, drawn in the same soft hand-drawn style.
3. **Title Text**: "めじるしアクセサリー" written in a fun, bold hand-drawn Japanese font.
4. **New Release Badge**: "${monthLabel ? monthLabel + ' ' : ''}新作" in a playful ribbon or starburst badge.
${price ? `5. **Price Tag**: A small hand-drawn price tag showing "${price}".` : ''}

**[Character/Theme - IMPORTANT]**
Decorate the charms with ${theme}. Do NOT draw any specific copyrighted characters or logos.

**[Absolute Rules]**
* The products are small CHARMS (accessories with rings/clips), not stickers and not candy
* Keep the overall design "just right" — neither too empty nor too noisy
* Make Japanese text clear and readable
* Use warm, inviting pastel colors that appeal to young girls
* Output only the image, no text explanation

Article title for context (do not render this as text): ${title}
`;
}

// フォールバック（コンテンツフィルタで弾かれたとき用の無難版）
function buildFallbackPrompt() {
  return `
Create a cute hand-drawn 16:9 illustration: small kawaii animal charms with tiny rings, clipped onto a pastel umbrella handle and a water bottle, next to a round capsule-toy machine. Soft pastel background with sparkles. Hand-written Japanese text "めじるしアクセサリー" and a badge "新作". Colored-pencil style, warm and inviting for young girls. No copyrighted characters. Output only the image.
`;
}

// =====================================
// 画像生成
// =====================================
async function generateImage(prompt, outputPath) {
  try {
    const result = await imageModel.generateContent(prompt);
    const response = await result.response;

    const candidate = response.candidates?.[0];
    if (!candidate) {
      console.warn('   candidatesが空です');
      return false;
    }
    if (candidate.finishReason === 'PROHIBITED_CONTENT' || candidate.finishReason === 'SAFETY') {
      console.warn(`   コンテンツフィルターによりブロック (${candidate.finishReason})`);
      return false;
    }
    const parts = candidate.content?.parts;
    if (!parts) {
      console.warn(`   partsが空です (finishReason: ${candidate.finishReason})`);
      return false;
    }
    const part = parts.find(p => p.inlineData);

    if (part && part.inlineData && part.inlineData.data) {
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      fs.writeFileSync(outputPath, buffer);
      return true;
    } else {
      console.warn('   Geminiからの有効な画像データがありませんでした');
      return false;
    }
  } catch (error) {
    console.error(`   画像生成エラー: ${error.message}`);
    if (error.message.includes('429')) {
      console.warn('   APIレート制限。5秒待機...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    return false;
  }
}

// =====================================
// frontmatter更新
// =====================================
function updateFrontmatter(filePath, content) {
  let updatedContent;
  if (/^imageGenerated:/m.test(content)) {
    updatedContent = content.replace(/^imageGenerated:.*$/m, 'imageGenerated: true');
  } else {
    updatedContent = content.replace(/^(---\n)/, '---\nimageGenerated: true\n');
  }
  fs.writeFileSync(filePath, updatedContent);
}

// =====================================
// メイン処理
// =====================================
async function main() {
  console.log('[Images] めじるしアイキャッチ生成開始 (Gemini AI)');

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY が設定されていません');
    process.exit(1);
  }
  if (!fs.existsSync(CONFIG.draftsDir)) {
    console.log('[Images] draftsディレクトリが見つかりません');
    return;
  }

  let generated = 0;
  let skipped = 0;

  const dateDirs = fs.readdirSync(CONFIG.draftsDir).filter(d =>
    fs.statSync(path.join(CONFIG.draftsDir, d)).isDirectory()
  );

  for (const dateDir of dateDirs) {
    const datePath = path.join(CONFIG.draftsDir, dateDir);
    const files = fs.readdirSync(datePath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      // imageGenerated: true / posted: true ならスキップ
      if (frontmatter.imageGenerated === 'true' || frontmatter.imageGenerated === true) {
        skipped++;
        continue;
      }
      if (frontmatter.posted === 'true' || frontmatter.posted === true) {
        skipped++;
        continue;
      }

      const slug = file.replace('.md', '');
      console.log(`\n[Images] 処理中: ${dateDir}/${slug}`);

      const outputDir = path.join(CONFIG.imagesDir, dateDir);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${slug}.png`);

      let success = await generateImage(buildPrompt(frontmatter), outputPath);
      if (!success) {
        console.log('   フォールバックプロンプトで再試行...');
        success = await generateImage(buildFallbackPrompt(), outputPath);
      }

      if (success) {
        updateFrontmatter(filePath, content);
        generated++;
        console.log(`   ✅ 保存: ${outputPath}`);
      } else {
        console.log('   ⚠️ 生成失敗（投稿はog:image→なしにフォールバックされます）');
      }

      await new Promise(res => setTimeout(res, 2000));
    }
  }

  console.log('\n========================================');
  console.log(`[Images] 完了: 生成 ${generated}件 / スキップ ${skipped}件`);
}

main().catch(console.error);
