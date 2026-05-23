/**
 * 新作販売記事から画像を生成する（Gemini AI使用）
 *
 * 使い方:
 *   node scripts/newreleases/generate-images.js
 *
 * 入力:
 *   output/new-releases/drafts/{date}/{slug}.md
 *
 * 出力:
 *   output/new-releases/images/{date}/{slug}.png
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const CONFIG = {
  draftsDir: 'output/new-releases/drafts',
  imagesDir: 'output/new-releases/images'
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const imageModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-image-preview',
  generationConfig: {
    responseModalities: ['IMAGE']
  }
});

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  const frontmatter = {};
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
      } else {
        frontmatter[key] = value.replace(/^["']|["']$/g, '');
        currentArray = null;
      }
    }
  }

  return { frontmatter, body };
}

const CHARACTER_INFO = {
  'ちいかわ': {
    brand: 'ちいかわ',
    description: 'Chiikawa characters - small, round, cute creatures',
    characters: [
      { name: 'ちいかわ', desc: 'a small white round creature with dot eyes and a simple smile, very cute and shy' },
      { name: 'ハチワレ', desc: 'a white and black cat-like creature with a split face pattern, cheerful personality' },
      { name: 'うさぎ', desc: 'a white rabbit with long ears, energetic and wild personality' },
      { name: 'モモンガ', desc: 'a small flying squirrel, fluffy and cute' },
      { name: 'くりまんじゅう', desc: 'a round chestnut-shaped creature, brown and cute' }
    ]
  },
  'サンリオ': {
    brand: 'Sanrio',
    description: 'Sanrio characters - iconic Japanese kawaii characters',
    characters: [
      { name: 'ハローキティ', desc: 'Hello Kitty - a white cat with a red bow, no mouth' },
      { name: 'マイメロディ', desc: 'My Melody - a white rabbit with a pink hood' },
      { name: 'シナモロール', desc: 'Cinnamoroll - a white puppy with long ears' },
      { name: 'ポムポムプリン', desc: 'Pompompurin - a golden retriever puppy with a brown beret' },
      { name: 'クロミ', desc: 'Kuromi - a white rabbit with a black jester hat' }
    ]
  },
  'すみっコぐらし': {
    brand: 'Sumikko Gurashi',
    description: 'Sumikko Gurashi - shy creatures who like corners',
    characters: [
      { name: 'しろくま', desc: 'a white polar bear who is shy' },
      { name: 'ぺんぎん？', desc: 'a green penguin-like creature' },
      { name: 'とんかつ', desc: 'a piece of tonkatsu pork cutlet' },
      { name: 'ねこ', desc: 'a shy cat' },
      { name: 'とかげ', desc: 'a blue dinosaur pretending to be a lizard' }
    ]
  }
};

function extractCharacterInfo(frontmatter) {
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const products = Array.isArray(frontmatter.products) ? frontmatter.products : [];

  let brand = null;
  let brandInfo = null;

  for (const tag of tags) {
    if (CHARACTER_INFO[tag]) {
      brand = tag;
      brandInfo = CHARACTER_INFO[tag];
      break;
    }
  }

  const characterNames = products
    .map(p => typeof p === 'object' ? p.name : p)
    .filter(name => name);

  let matchedCharacters = [];
  if (brandInfo && brandInfo.characters.length > 0) {
    for (const charName of characterNames) {
      const found = brandInfo.characters.find(c =>
        charName.includes(c.name) || c.name.includes(charName)
      );
      if (found) matchedCharacters.push(found);
    }
    if (matchedCharacters.length === 0) {
      matchedCharacters = brandInfo.characters.slice(0, 3);
    }
  }

  return { brand: brand || tags[1] || 'かわいいキャラクター', brandInfo, characterNames, matchedCharacters };
}

function formatDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  try {
    const date = new Date(deadlineStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours === 23 && minutes === 59) return `${month}/${day}`;
    return `${month}/${day} ${hours}:${String(minutes).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

function buildPrompt(frontmatter) {
  const type = frontmatter.type || 'other';
  const store = frontmatter.store || '';
  const title = frontmatter.title || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  const deadline = formatDeadline(frontmatter.deadline);

  const { brand, brandInfo, characterNames, matchedCharacters } = extractCharacterInfo(frontmatter);

  let characterDescription = '';
  if (matchedCharacters.length > 0) {
    characterDescription = matchedCharacters.map(c => `- **${c.name}**: ${c.desc}`).join('\n');
  } else if (characterNames.length > 0) {
    characterDescription = `Characters: ${characterNames.join(', ')}`;
  }

  const brandDesc = brandInfo ? brandInfo.description : `${brand} characters`;

  if (type === 'lottery' || type === 'new-release') {
    return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article about a new release lottery sale event.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: Soft pastel colors (light pink, light blue, or light yellow) with subtle patterns.

**[Main Elements]**
1. **Product Illustration**: Draw cute "ボンボンドロップシール" (puffy stickers) in the center
2. **Store Name**: "${store}" written in a fun, bold hand-drawn Japanese font
3. **Event Badge**: "新作販売" in a playful banner or ribbon design
${deadline ? `4. **Deadline Date (MANDATORY)**: Draw a calendar or banner showing the deadline date "${deadline}" clearly. Write "締切 ${deadline}" prominently` : ''}

**[Character/Theme - IMPORTANT]**
Brand: **${brand}** (${brandDesc})

${characterDescription ? `**Draw these specific characters on the stickers:**\n${characterDescription}` : `Draw cute ${brand} themed characters`}

**[Absolute Rules]**
* **MUST draw the actual characters** described above - they should be recognizable
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS** (puffy seal stickers), not candy
* Make Japanese text clear and readable
* Use warm, inviting colors that appeal to collectors
* Output only the image, no text explanation
`;
  }

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

async function generateImage(prompt, outputPath) {
  try {
    const result = await imageModel.generateContent(prompt);
    const response = await result.response;
    const part = response.candidates[0].content.parts.find(p => p.inlineData);

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

function updateFrontmatter(filePath, content) {
  let updatedContent;
  if (/^imageGenerated:/m.test(content)) {
    updatedContent = content.replace(/^imageGenerated:.*$/m, 'imageGenerated: true');
  } else {
    updatedContent = content.replace(/^(---\n)/, '---\nimageGenerated: true\n');
  }
  fs.writeFileSync(filePath, updatedContent);
}

async function main() {
  console.log('[Images] 新作販売記事の画像生成開始 (Gemini AI)');

  if (!process.env.GEMINI_API_KEY) {
    console.error('[Images] エラー: GEMINI_API_KEY が設定されていません');
    process.exit(1);
  }

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

      if (frontmatter.imageGenerated === 'true' || frontmatter.imageGenerated === true) {
        totalSkipped++;
        continue;
      }

      const slug = file.replace('.md', '');
      console.log(`\n[Images] 処理中: ${dateDir}/${slug}`);

      const outputDir = path.join(CONFIG.imagesDir, dateDir);
      fs.mkdirSync(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${slug}.png`);
      const prompt = buildPrompt(frontmatter);
      const success = await generateImage(prompt, outputPath);

      if (success) {
        console.log(`   保存: ${outputPath}`);
        updateFrontmatter(filePath, content);
        console.log('   frontmatter更新: imageGenerated: true');
        totalGenerated++;
      } else {
        totalErrors++;
      }

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
