/**
 * 目撃情報 週間まとめ記事 画像生成スクリプト
 *
 * output/sightings/weekly-roundups/{week-start}/*.md の各記事に対して、
 * Gemini AI で「週間まとめ」風のアイキャッチ画像を生成する。
 *
 * 入力:
 *   - output/sightings/weekly-roundups/{week-start}/*.md（imageGenerated: false のもの）
 * 出力:
 *   - output/sightings/weekly-roundups/{week-start}/{prefRomaji}.png
 *   - md の frontmatter を imageGenerated: true に更新
 *
 * 使い方:
 *   node scripts/sightings/generate-weekly-roundup-images.js
 *   node scripts/sightings/generate-weekly-roundup-images.js --week-start 2026-05-04
 */

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ROUNDUPS_DIR = 'output/weekly-roundup';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const imageModel = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-image-preview' });

// 地方別カラー（newreleasesの設定と同等）
const PREF_TO_REGION_COLOR = {
  "北海道": "#4FC3F7", "青森県": "#4FC3F7", "岩手県": "#4FC3F7", "宮城県": "#4FC3F7",
  "秋田県": "#4FC3F7", "山形県": "#4FC3F7", "福島県": "#4FC3F7",
  "茨城県": "#FF6699", "栃木県": "#FF6699", "群馬県": "#FF6699", "埼玉県": "#FF6699",
  "千葉県": "#FF6699", "東京都": "#FF6699", "神奈川県": "#FF6699",
  "新潟県": "#FF9800", "富山県": "#FF9800", "石川県": "#FF9800", "福井県": "#FF9800",
  "山梨県": "#FF9800", "長野県": "#FF9800", "岐阜県": "#FF9800", "静岡県": "#FF9800",
  "愛知県": "#FF9800",
  "三重県": "#BA68C8", "滋賀県": "#BA68C8", "京都府": "#BA68C8", "大阪府": "#BA68C8",
  "兵庫県": "#BA68C8", "奈良県": "#BA68C8", "和歌山県": "#BA68C8",
  "鳥取県": "#4CAF50", "島根県": "#4CAF50", "岡山県": "#4CAF50", "広島県": "#4CAF50",
  "山口県": "#4CAF50", "徳島県": "#4CAF50", "香川県": "#4CAF50", "愛媛県": "#4CAF50",
  "高知県": "#4CAF50",
  "福岡県": "#EF5350", "佐賀県": "#EF5350", "長崎県": "#EF5350", "熊本県": "#EF5350",
  "大分県": "#EF5350", "宮崎県": "#EF5350", "鹿児島県": "#EF5350", "沖縄県": "#EF5350"
};

// =====================================
// 引数パース
// =====================================
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { weekStart: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week-start' && args[i + 1]) out.weekStart = args[++i];
  }
  return out;
}

// =====================================
// frontmatterパース（簡易版）
// =====================================
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { frontmatter: {}, body: content };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { frontmatter: fm, body: content.slice(m[0].length).trim() };
}

function updateFrontmatterImageGenerated(filePath, content) {
  const updated = /^imageGenerated:/m.test(content)
    ? content.replace(/^imageGenerated:.*$/m, 'imageGenerated: true')
    : content.replace(/^(---\n)/, '---\nimageGenerated: true\n');
  fs.writeFileSync(filePath, updated);
}

// =====================================
// プロンプト生成
// =====================================
function buildPrompt(frontmatter) {
  const pref = frontmatter.prefecture || '';
  const count = frontmatter.totalCount || '?';
  const weekStart = frontmatter.weekStart || '';
  const weekEnd = frontmatter.weekEnd || '';
  const color = PREF_TO_REGION_COLOR[pref] || '#FF6699';

  return `
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a weekly summary web article.
The image conveys "this week's sighting roundup" of popular puffy stickers in a specific Japanese prefecture.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. Cute "Yume-Kawaii" pop atmosphere.
* **Background**: A **pale, light shade** based on the region color (${color}). Add a subtle, soft pattern (faint polka dots or gentle stripes), but keep it unobtrusive.

**[Text Elements (Mandatory)]**
1. **"週間まとめ" Ribbon**:
   * Text: "週間まとめ"
   * Style: A bold ribbon or banner placed diagonally in the **Top Left corner**
2. **Prefecture Name (Hero)**:
   * Text: "${pref}"
   * Position: Center, large
   * Style: Fun, bold, hand-drawn Japanese font with a soft outline
3. **Sighting Count Stamp**:
   * Text: "${count}件"
   * Style: Round red rubber stamp, tilted diagonally in the **Bottom Right corner**

**[Main Visual]**
Multiple "ボンボンドロップシール" (puffy / jelly-like stickers) scattered around the prefecture name. Show them as cute, glossy, dome-shaped stickers (NOT candy).

**[Absolute Rules]**
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS**, not candy
* Ensure Japanese text is rendered exactly as written above
* Output only the image, no explanation text
`;
}

// =====================================
// 画像生成
// =====================================
async function generateImage(prompt, outputPath) {
  try {
    const result = await imageModel.generateContent(prompt);
    const response = await result.response;
    const part = response.candidates[0].content.parts.find(p => p.inlineData);
    if (part && part.inlineData && part.inlineData.data) {
      fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, 'base64'));
      return true;
    }
    console.warn('   Geminiから有効な画像データなし');
    return false;
  } catch (e) {
    console.error(`   画像生成エラー: ${e.message}`);
    if (e.message.includes('429')) {
      console.warn('   レート制限。5秒待機...');
      await new Promise(r => setTimeout(r, 5000));
    }
    return false;
  }
}

// =====================================
// メイン
// =====================================
async function main() {
  console.log('[WeeklyRoundupImages] 画像生成開始 (Gemini AI)');
  if (!process.env.GEMINI_API_KEY) {
    console.error('[WeeklyRoundupImages] GEMINI_API_KEY 未設定');
    process.exit(1);
  }
  if (!fs.existsSync(ROUNDUPS_DIR)) {
    console.log('[WeeklyRoundupImages] 出力ディレクトリなし');
    return;
  }

  const args = parseArgs();
  const weekDirs = args.weekStart ? [args.weekStart] : fs.readdirSync(ROUNDUPS_DIR)
    .filter(d => fs.statSync(path.join(ROUNDUPS_DIR, d)).isDirectory());

  let generated = 0, skipped = 0, errors = 0;

  for (const weekDir of weekDirs) {
    const weekPath = path.join(ROUNDUPS_DIR, weekDir);
    if (!fs.existsSync(weekPath)) continue;

    const files = fs.readdirSync(weekPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(weekPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      if (frontmatter.imageGenerated === 'true' || frontmatter.imageGenerated === true) {
        skipped++;
        continue;
      }

      const slug = file.replace('.md', '');
      console.log(`\n[WeeklyRoundupImages] 処理中: ${weekDir}/${slug}`);

      const outputPath = path.join(weekPath, `${slug}.png`);
      const prompt = buildPrompt(frontmatter);
      const success = await generateImage(prompt, outputPath);

      if (success) {
        console.log(`   保存: ${outputPath}`);
        updateFrontmatterImageGenerated(filePath, content);
        console.log('   frontmatter更新: imageGenerated: true');
        generated++;
      } else {
        errors++;
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n========================================');
  console.log(`[WeeklyRoundupImages] 完了: 生成 ${generated}件 / スキップ ${skipped}件 / エラー ${errors}件`);
}

main().catch(console.error);
