/**
 * 記事から画像を生成する（Gemini AI使用）
 *
 * 使い方:
 *   node scripts/lotteryinfo/generate-images.js
 *
 * 入力:
 *   output/lottery-info/drafts/{date}/{slug}.md
 *
 * 出力:
 *   output/lottery-info/images/{date}/{slug}.png
 *
 * 機能:
 *   - Gemini AIで画像生成
 *   - 記事タイプに応じたプロンプト使用
 *   - 生成済み記事はimageGeneratedフラグで管理
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
  draftsDir: 'output/lottery-info/drafts',
  imagesDir: 'output/lottery-info/images'
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
// frontmatter パーサー
// =====================================
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  // シンプルなYAMLパーサー
  const frontmatter = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of frontmatterStr.split('\n')) {
    // 配列アイテム
    if (line.match(/^\s+-\s+/) && currentArray) {
      const value = line.replace(/^\s+-\s+/, '').trim();
      if (value.startsWith('name:')) {
        // products配列の場合
        const obj = {};
        obj.name = value.replace('name:', '').trim().replace(/^["']|["']$/g, '');
        currentArray.push(obj);
      } else {
        currentArray.push(value.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // priceなどの続き
    if (line.match(/^\s+price:/) && currentArray && currentArray.length > 0) {
      const lastItem = currentArray[currentArray.length - 1];
      if (typeof lastItem === 'object') {
        lastItem.price = parseInt(line.replace(/^\s+price:\s*/, ''));
      }
      continue;
    }

    // キー: 値
    const kvMatch = line.match(/^(\w+):\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      if (value === '') {
        // 配列開始
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
// キャラクター情報
// =====================================
const CHARACTER_INFO = {
  'ちいかわ': {
    brand: 'ちいかわ',
    description: 'Chiikawa characters - small, round, cute creatures',
    characters: [
      { name: 'ちいかわ', desc: 'a small white round creature with dot eyes and a simple smile, very cute and shy' },
      { name: 'ハチワレ', desc: 'a white and black cat-like creature with a split face pattern (half white, half black), cheerful personality' },
      { name: 'うさぎ', desc: 'a white rabbit with long ears, energetic and wild personality, often shown excited' },
      { name: 'モモンガ', desc: 'a small flying squirrel, fluffy and cute' },
      { name: 'くりまんじゅう', desc: 'a round chestnut-shaped creature, brown and cute' }
    ]
  },
  'サンリオ': {
    brand: 'Sanrio',
    description: 'Sanrio characters - iconic Japanese kawaii characters',
    characters: [
      { name: 'ハローキティ', desc: 'Hello Kitty - a white cat with a red bow, no mouth, iconic Sanrio character' },
      { name: 'マイメロディ', desc: 'My Melody - a white rabbit with a pink hood, sweet and gentle' },
      { name: 'シナモロール', desc: 'Cinnamoroll - a white puppy with long ears, blue eyes, can fly with ears' },
      { name: 'ポムポムプリン', desc: 'Pompompurin - a golden retriever puppy with a brown beret, loves pudding' },
      { name: 'クロミ', desc: 'Kuromi - a white rabbit with a black jester hat with pink skull, mischievous' },
      { name: 'けろけろけろっぴ', desc: 'Keroppi - a green frog with big eyes and a V-shaped mouth' }
    ]
  },
  'すみっコぐらし': {
    brand: 'Sumikko Gurashi',
    description: 'Sumikko Gurashi - shy creatures who like corners',
    characters: [
      { name: 'しろくま', desc: 'a white polar bear who is shy and likes warm places' },
      { name: 'ぺんぎん？', desc: 'a green penguin-like creature, unsure if really a penguin' },
      { name: 'とんかつ', desc: 'a piece of tonkatsu (pork cutlet) with a bit of fat' },
      { name: 'ねこ', desc: 'a shy cat who worries about its body shape' },
      { name: 'とかげ', desc: 'a blue dinosaur pretending to be a lizard' }
    ]
  },
  'moji': {
    brand: 'Sanrio moji',
    description: 'Sanrio moji series - expressive character stickers',
    characters: []
  }
};

// =====================================
// キャラクター抽出
// =====================================
function extractCharacterInfo(frontmatter) {
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const products = Array.isArray(frontmatter.products) ? frontmatter.products : [];

  // ブランドを特定
  let brand = null;
  let brandInfo = null;

  for (const tag of tags) {
    if (CHARACTER_INFO[tag]) {
      brand = tag;
      brandInfo = CHARACTER_INFO[tag];
      break;
    }
  }

  // productsからキャラクター名を抽出
  const characterNames = products
    .map(p => typeof p === 'object' ? p.name : p)
    .filter(name => name);

  // マッチするキャラクター情報を取得
  let matchedCharacters = [];
  if (brandInfo && brandInfo.characters.length > 0) {
    for (const charName of characterNames) {
      const found = brandInfo.characters.find(c =>
        charName.includes(c.name) || c.name.includes(charName)
      );
      if (found) {
        matchedCharacters.push(found);
      }
    }
    // マッチしなかった場合は最初の3キャラを使用
    if (matchedCharacters.length === 0) {
      matchedCharacters = brandInfo.characters.slice(0, 3);
    }
  }

  return {
    brand: brand || tags[1] || 'かわいいキャラクター',
    brandInfo,
    characterNames,
    matchedCharacters
  };
}

// =====================================
// 締め切り日フォーマット
// =====================================
function formatDeadline(deadlineStr) {
  if (!deadlineStr) return null;

  try {
    const date = new Date(deadlineStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // 時間も含める
    if (hours === 23 && minutes === 59) {
      return `${month}/${day}`;
    }
    return `${month}/${day} ${hours}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

// =====================================
// プロンプト生成
// =====================================
function buildPrompt(frontmatter) {
  const type = frontmatter.type || 'other';
  const store = frontmatter.store || '';
  const title = frontmatter.title || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const deadline = formatDeadline(frontmatter.deadline);

  // キャラクター情報を抽出
  const { brand, brandInfo, characterNames, matchedCharacters } = extractCharacterInfo(frontmatter);

  // キャラクター説明を構築
  let characterDescription = '';
  if (matchedCharacters.length > 0) {
    characterDescription = matchedCharacters
      .map(c => `- **${c.name}**: ${c.desc}`)
      .join('\n');
  } else if (characterNames.length > 0) {
    characterDescription = `Characters: ${characterNames.join(', ')}`;
  }

  const brandDesc = brandInfo ? brandInfo.description : `${brand} characters`;

  // 著作権保護ブランドはジェネリック表現に変換
  const COPYRIGHT_BRANDS = ['ディズニー', 'Disney', 'たまごっち', 'Tamagotchi'];
  const isCopyrightBrand = COPYRIGHT_BRANDS.some(b => brand.includes(b) || tags.some(t => t.includes(b)));

  const characterTheme = isCopyrightBrand
    ? `Draw cute fantasy-themed kawaii characters inspired by magical adventure (castles, stars, hearts, magic wands) on the stickers. No specific branded characters.`
    : (characterDescription
        ? `**Draw these specific characters on the stickers:**\n${characterDescription}`
        : `Draw cute ${brand} themed characters`);

  if (type === 'lottery') {
    return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article about a lottery sale event.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: Soft pastel colors (light pink, light blue, or light yellow) with subtle patterns.

**[Main Elements]**
1. **Product Illustration**: Draw cute "ボンボンドロップシール" (puffy stickers) in the center. They are colorful, round, puffy stickers featuring cute characters.
2. **Store Name**: "${store}" written in a fun, bold hand-drawn Japanese font
3. **Event Badge**: "抽選販売" in a playful banner or ribbon design
4. **Deadline Date (MANDATORY)**: Draw a calendar or banner showing the deadline date "${deadline}" clearly. This MUST be visible and readable. Write "締切 ${deadline}" or "応募締切 ${deadline}" prominently

**[Character/Theme - IMPORTANT]**
${characterTheme}

**[Absolute Rules]**
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS** (puffy seal stickers), not candy
* Make Japanese text clear and readable
* Use warm, inviting colors that appeal to collectors
* Output only the image, no text explanation
`;
  }

  if (type === 'sighting') {
    const prefecture = tags.find(t =>
      ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島',
        '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川',
        '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知',
        '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山',
        '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知',
        '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'].includes(t)
    ) || '東京';

    return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article.
The image conveys a "Breaking News" report about finding a popular item. It should be playful and cute, but NOT overly cluttered.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: A **pale, light shade** (pink, blue, or yellow). You may use a very subtle, soft pattern (like faint polka dots or a light grid), but keep it unobtrusive.

**[Text Elements (Mandatory)]**
1. **"目撃速報" Stamp**:
   * Text: "目撃速報" (Breaking News)
   * Style: Red rubber stamp, tilted diagonally in the **Top Right corner**
2. **Location Name**:
   * Text: "${prefecture}" (Large)
   * Position: Prominently placed near the center or beside the product
   * Style: Fun, bold, hand-drawn font with a soft outline

**[Character/Theme - IMPORTANT]**
Brand: **${brand}** (${brandDesc})

${characterDescription ? `**Draw these specific characters on the stickers:**\n${characterDescription}` : `Draw cute ${brand} themed characters`}

**[Absolute Rules]**
* **MUST draw the actual characters** described above - they should be recognizable
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS**, not candy
* Ensure the Japanese text is rendered exactly as written
* Output only the image, no text explanation
`;
  }

  // その他
  const keywordsStr = tags.join(', ') || 'ボンボンドロップシール';

  return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article.
Create an impactful visual that conveys the main point at a glance, without becoming overly cluttered.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Touch**: Hand-drawn style (colored pencils, crayons). Warm, cute, "Yume-Kawaii" pop atmosphere
* **Background**: Soft pastel colors with subtle, cute patterns (dots, faint stars)

**[Main Visual]**
* **Subject**: "ボンボンドロップシール" refers to popular **puffy stickers** (not candy)
* **Title**: ${title}

**[Character/Theme - IMPORTANT]**
Brand: **${brand}** (${brandDesc})

${characterDescription ? `**Draw these specific characters:**\n${characterDescription}` : `Draw cute ${brand} themed characters`}

**[Absolute Rules]**
* **MUST draw the actual characters** described above - they should be recognizable
* Keep good balance of negative space and cute elements
* Minimal text (main keywords only)
* Output only the image, no text explanation
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
      console.warn(`   コンテンツフィルターによりブロック (${candidate.finishReason})。フォールバックプロンプトで再試行...`);
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
    // 既存フィールドを上書き（重複防止）
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
  console.log('[Images] 画像生成開始 (Gemini AI)');

  if (!process.env.GEMINI_API_KEY) {
    console.error('[Images] エラー: GEMINI_API_KEY が設定されていません');
    process.exit(1);
  }

  // draftsディレクトリを走査
  if (!fs.existsSync(CONFIG.draftsDir)) {
    console.log('[Images] draftsディレクトリが見つかりません');
    return;
  }

  const dateDirs = fs.readdirSync(CONFIG.draftsDir).filter(d =>
    fs.statSync(path.join(CONFIG.draftsDir, d)).isDirectory()
  );

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const dateDir of dateDirs) {
    const datePath = path.join(CONFIG.draftsDir, dateDir);
    const files = fs.readdirSync(datePath).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      // imageGenerated: true ならスキップ
      if (frontmatter.imageGenerated === 'true' || frontmatter.imageGenerated === true) {
        totalSkipped++;
        continue;
      }

      const slug = file.replace('.md', '');
      console.log(`\n[Images] 処理中: ${dateDir}/${slug}`);

      // 出力ディレクトリ作成
      const outputDir = path.join(CONFIG.imagesDir, dateDir);
      fs.mkdirSync(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${slug}.png`);

      // プロンプト生成
      const prompt = buildPrompt(frontmatter);

      // 画像生成
      const success = await generateImage(prompt, outputPath);

      if (success) {
        console.log(`   保存: ${outputPath}`);
        // frontmatter更新
        updateFrontmatter(filePath, content);
        console.log('   frontmatter更新: imageGenerated: true');
        totalGenerated++;
      } else {
        totalErrors++;
      }

      // API制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n========================================');
  console.log(`[Images] 完了: 生成 ${totalGenerated}件 / スキップ ${totalSkipped}件 / エラー ${totalErrors}件`);

  if (totalGenerated > 0) {
    console.log(`\n保存先: ${CONFIG.imagesDir}/`);
  }
}

main().catch(console.error);
