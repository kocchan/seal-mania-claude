/**
 * めじるしサムネの「使い回しベース素材」をGeminiで生成する（原則1回だけ実行）
 *
 * ストック素材方式:
 *   高品質なベースイラスト（文字なし・特定キャラなし）を複数枚作ってリポジトリに保存し、
 *   記事投稿時は文字（タイトル/◯月新作/価格）だけをPillowで合成する。
 *   → 生成コストは初回のみ。運用はGitHub Actionsで完結（ComfyUI/ローカル不要）。
 *
 * 使い方:
 *   node scripts/mejirushi/generate-base-assets.js        # 全バリエーション生成
 *   node scripts/mejirushi/generate-base-assets.js 3      # variation 3 だけ再生成
 *
 * 出力: assets/mejirushi-thumbs/base-{01..05}.png
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const OUT_DIR = 'assets/mejirushi-thumbs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const imageModel = genAI.getGenerativeModel({
  model: 'gemini-3.1-flash-image-preview',
  generationConfig: { responseModalities: ['IMAGE'] }
});

// 共通の描画ルール：文字なし・上部/右上に余白・ジェネリック動物のみ
const COMMON = `
You are a professional illustrator creating a **reusable base illustration** for blog thumbnails about "めじるしアクセサリー" (small mascot charms attached to belongings as identification marks, sold in capsule toy machines in Japan).

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Warm hand-drawn style with colored pencils / soft markers. Cute and inviting for young girls.
* **Background**: Soft pastel tones with subtle patterns (dots, sparkles).

**[CRITICAL LAYOUT RULES]**
* **NO TEXT AT ALL.** No letters, no numbers, no Japanese characters, no logos, no signage, no words on any object. Text will be added later programmatically. This is the single most important rule.
* **NO badges, medals, rosettes, ribbons-awards, or stamp-like circles anywhere.** A badge graphic will be added later.
* **Keep the TOP-CENTER area (upper 22% of the image) visually calm/empty-ish** — a title will be placed there later.
* **Keep the TOP-RIGHT corner clear** — a badge will be placed there later.
* Main motifs should sit in the lower 2/3 of the composition.

**[Character Rules]**
* Use only GENERIC cute animals (kitten, bunny, bear cub, chick, penguin). No branded/copyrighted characters.

**[Absolute Rules]**
* The products are small charms with tiny clips/rings — show them ATTACHED to belongings.
* Balanced composition, not cluttered. Output only the image.
`;

const VARIATIONS = {
  '01': 'Scene: a pastel umbrella handle and a cute water bottle, each with a tiny animal mascot charm clipped on. A few colored pencils framing the edges.',
  '02': 'Scene: a mint-colored school bag / randoseru with an animal mascot charm on the zipper, next to a small red capsule toy machine full of colorful capsules.',
  '03': 'Scene: a pink pouch and a pastel tumbler on a desk, each with a small animal charm attached; scattered flowers and sparkles around.',
  '04': 'Scene: a row of three tiny animal mascot charms (kitten, bunny, bear) with keyring clips, displayed like collectibles above an open capsule; soft rainbow arc in background.',
  '05': 'Scene: a hand-drawn capsule toy machine (gashapon) with colorful capsules, one open capsule revealing a bunny charm; umbrella and bottle silhouettes in soft background.'
};

async function generateOne(key, scene) {
  const prompt = COMMON + '\n**[This Variation]**\n' + scene;
  const outPath = `${OUT_DIR}/base-${key}.png`;
  console.log(`\n[BaseAssets] 生成中: base-${key}`);
  try {
    const result = await imageModel.generateContent(prompt);
    const response = await result.response;
    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) { console.warn('  ⚠️ 画像データなし'); return false; }
    fs.writeFileSync(outPath, Buffer.from(part.inlineData.data, 'base64'));
    console.log(`  ✅ 保存: ${outPath}`);
    return true;
  } catch (e) {
    console.error(`  ❌ 失敗: ${e.message}`);
    return false;
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) { console.error('❌ GEMINI_API_KEYがありません'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const only = process.argv[2]; // 例: "3" → base-03のみ
  const targets = only
    ? Object.entries(VARIATIONS).filter(([k]) => parseInt(k) === parseInt(only))
    : Object.entries(VARIATIONS);

  let ok = 0;
  for (const [key, scene] of targets) {
    if (await generateOne(key, scene)) ok++;
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(`\n[BaseAssets] 完了: ${ok}/${targets.length}枚`);
}

main().catch(console.error);
