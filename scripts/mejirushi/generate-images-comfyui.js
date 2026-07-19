/**
 * めじるしアクセサリー新作記事のアイキャッチ画像を生成する（ComfyUI・無料ローカル生成版）
 *
 * Gemini版（generate-images.js）の代替。API費用ゼロでローカルのComfyUIを使う。
 * SD系モデルは日本語文字の描画が苦手なため、2段構成を採る：
 *   1. ComfyUI（Stable Diffusion）で「文字なしのイラスト」を生成
 *   2. compose-text.py（Pillow）で日本語タイトル・バッジ・価格タグをフォント合成
 *
 * 使い方:
 *   node scripts/mejirushi/generate-images-comfyui.js
 *
 * 前提:
 *   - ComfyUI が http://127.0.0.1:8188 で起動していること
 *     （~/ComfyUI で ./venv/bin/python main.py --listen 127.0.0.1）
 *   - models/checkpoints/CounterfeitV30_fp16.safetensors が存在すること
 *
 * 入力:  output/mejirushi/drafts/{date}/{slug}.md
 * 出力:  output/mejirushi/images/{date}/{slug}.png （1200x675, 16:9）
 * フラグ: imageGenerated（Gemini版と同じ・冪等）
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import axios from 'axios';

const CONFIG = {
  draftsDir: 'output/mejirushi/drafts',
  imagesDir: 'output/mejirushi/images',
  comfyUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
  // 既存の他プロジェクト（326/328）で導入済みのSDXLアニメモデルを利用
  checkpoint: process.env.COMFYUI_CHECKPOINT || 'animagine-xl-4.0-opt.safetensors',
  // SDXLネイティブの16:9（約1MP）→ 後段Pillowで1200x675へ整形
  width: 1344,
  height: 768,
  steps: 25,
  cfg: 6,
  samplerName: 'euler_ancestral',
  scheduler: 'normal'
};

// =====================================
// frontmatter パーサー（簡易・generate-images.jsと同じ）
// =====================================
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter = {};
  let currentArray = null;
  for (const line of match[1].split('\n')) {
    if (line.match(/^\s+-\s+/) && currentArray) {
      currentArray.push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      if (kv[2].trim() === '') {
        frontmatter[kv[1]] = [];
        currentArray = frontmatter[kv[1]];
      } else {
        frontmatter[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
        currentArray = null;
      }
    }
  }
  return { frontmatter };
}

// =====================================
// プロンプト（文字は描かせない。Gemini版と同じ画題・パステル手描き風）
// =====================================
const THEME_MOTIFS = {
  'サンリオ': 'cute white kitten mascot with red ribbon, pastel pink bunny mascot',
  'ちいかわ': 'small round chubby white hamster-like mascot',
  'すみっコぐらし': 'shy round pastel bear and cat mascots',
  'ディズニー': 'magical castle silhouette, sparkling stars',
  'mofusand': 'fluffy kitten mascots in cute costumes'
};

function buildPrompts(frontmatter) {
  const brand = frontmatter.brand || '';
  const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
  let motif = 'cute pastel animal mascots';
  for (const [k, v] of Object.entries(THEME_MOTIFS)) {
    if (brand.includes(k) || tags.some(t => t.includes(k))) { motif = v; break; }
  }
  // animagine-xl-4.0 のタグベース記法＋推奨クオリティタグ
  const positive =
    `no humans, scenery, capsule toy machine, gashapon, colorful capsules, ` +
    `tiny mascot charms with keyring clips, charms hanging on pastel umbrella handle, cute water bottle, ` +
    `${motif}, sparkles, polka dots, flowers, pastel pink background, lavender, mint, ` +
    `flat color, pastel colors, hand-drawn style, colored pencil texture, kawaii, chibi, ` +
    `wide shot, product illustration, masterpiece, high score, great score, absurdres`;
  const negative =
    `text, letters, typography, watermark, signature, logo, username, ` +
    `1girl, 1boy, human, face, hands, realistic, photorealistic, 3d, ` +
    `dark, horror, messy, cluttered, lowres, bad quality, worst quality, jpeg artifacts`;
  return { positive, negative };
}

// =====================================
// ComfyUI APIワークフロー（txt2img最小構成）
// =====================================
function buildWorkflow(positive, negative, seed) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: CONFIG.checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: CONFIG.width, height: CONFIG.height, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
        seed, steps: CONFIG.steps, cfg: CONFIG.cfg,
        sampler_name: CONFIG.samplerName, scheduler: CONFIG.scheduler, denoise: 1.0
      }
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'mejirushi' } }
  };
}

async function generateViaComfy(positive, negative) {
  const seed = Math.floor(Math.random() * 1e15);
  const { data } = await axios.post(`${CONFIG.comfyUrl}/prompt`, { prompt: buildWorkflow(positive, negative, seed) });
  const promptId = data.prompt_id;

  // ポーリングで完了待ち（SDXL/M2で2〜8分程度）
  for (let i = 0; i < 240; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { data: hist } = await axios.get(`${CONFIG.comfyUrl}/history/${promptId}`);
    const entry = hist[promptId];
    if (entry && entry.status?.completed) {
      const images = Object.values(entry.outputs).flatMap(o => o.images || []);
      if (!images.length) throw new Error('ComfyUI出力に画像がありません');
      const img = images[0];
      const res = await axios.get(`${CONFIG.comfyUrl}/view`, {
        params: { filename: img.filename, subfolder: img.subfolder || '', type: img.type },
        responseType: 'arraybuffer'
      });
      return Buffer.from(res.data);
    }
    if (entry && entry.status?.status_str === 'error') {
      throw new Error('ComfyUI実行エラー: ' + JSON.stringify(entry.status.messages || []).slice(0, 300));
    }
  }
  throw new Error('ComfyUI生成タイムアウト');
}

// =====================================
// メイン
// =====================================
async function main() {
  console.log('[Images/ComfyUI] めじるしアイキャッチ生成開始（ローカル・無料）');

  // ComfyUI疎通確認
  try {
    await axios.get(`${CONFIG.comfyUrl}/system_stats`, { timeout: 5000 });
  } catch {
    console.error(`❌ ComfyUIに接続できません: ${CONFIG.comfyUrl}`);
    console.error('   起動方法: cd ~/ComfyUI && ./venv/bin/python main.py');
    process.exit(1);
  }

  if (!fs.existsSync(CONFIG.draftsDir)) {
    console.log('[Images/ComfyUI] draftsディレクトリが見つかりません');
    return;
  }

  let generated = 0, skipped = 0;
  const dateDirs = fs.readdirSync(CONFIG.draftsDir).filter(d =>
    fs.statSync(path.join(CONFIG.draftsDir, d)).isDirectory());

  for (const dateDir of dateDirs) {
    const datePath = path.join(CONFIG.draftsDir, dateDir);
    for (const file of fs.readdirSync(datePath).filter(f => f.endsWith('.md'))) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      if (frontmatter.imageGenerated === 'true' || frontmatter.posted === 'true') { skipped++; continue; }

      const slug = file.replace('.md', '');
      console.log(`\n[Images/ComfyUI] 処理中: ${dateDir}/${slug}`);

      const outputDir = path.join(CONFIG.imagesDir, dateDir);
      fs.mkdirSync(outputDir, { recursive: true });
      const rawPath = path.join(outputDir, `${slug}.raw.png`);
      const outputPath = path.join(outputDir, `${slug}.png`);

      try {
        const { positive, negative } = buildPrompts(frontmatter);
        console.log('  🎨 ComfyUIで生成中（30〜90秒）...');
        const buf = await generateViaComfy(positive, negative);
        fs.writeFileSync(rawPath, buf);

        // 日本語テキスト合成（タイトル帯・新作バッジ・価格タグ）
        console.log('  ✏️ 日本語テキスト合成中...');
        const m = (frontmatter.salesDate || '').match(/^\d{4}-(\d{2})/);
        const monthLabel = m ? `${parseInt(m[1])}月新作` : '新作';
        execFileSync('python3', [
          'scripts/mejirushi/compose-text.py',
          rawPath, outputPath,
          '--title', 'めじるしアクセサリー',
          '--badge', monthLabel,
          '--price', frontmatter.priceRange || ''
        ], { stdio: 'inherit' });
        fs.unlinkSync(rawPath);

        // フラグ更新（Gemini版と同じ）
        let updated;
        if (/^imageGenerated:/m.test(content)) {
          updated = content.replace(/^imageGenerated:.*$/m, 'imageGenerated: true');
        } else {
          updated = content.replace(/^(---\n)/, '---\nimageGenerated: true\n');
        }
        fs.writeFileSync(filePath, updated);
        generated++;
        console.log(`  ✅ 保存: ${outputPath}`);
      } catch (e) {
        console.error(`  ⚠️ 生成失敗（投稿はog:image→なしにフォールバック）: ${e.message}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`[Images/ComfyUI] 完了: 生成 ${generated}件 / スキップ ${skipped}件`);
}

main().catch(e => { console.error(e); process.exit(1); });
