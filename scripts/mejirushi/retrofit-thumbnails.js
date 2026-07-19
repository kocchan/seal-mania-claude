/**
 * めじるし記事のサムネをComfyUIで「後付け」する（ローカル実行・無料）
 *
 * 背景:
 *   投稿はGitHub Actions（毎日10:30）が行うが、ComfyUIはこのMacでしか
 *   動かない。そこで投稿とサムネ生成を分離する:
 *     - Actions: サムネなし（またはog:image仮アイキャッチ）で投稿 ← 止まらない
 *     - このスクリプト（ローカル・launchd/cron）: サムネが無い/仮の投稿を
 *       見つけて ComfyUI生成 → WPメディアへアップ → featured_media を差し替え
 *
 * 対象の判定:
 *   カテゴリ「めじるしアクセサリー」(slug: mejirushi) の公開記事のうち
 *     a) featured_media が 0（アイキャッチなし）
 *     b) featured_media のファイル名に「-og.」を含む（og:imageの仮アイキャッチ）
 *
 * 使い方:
 *   node scripts/mejirushi/retrofit-thumbnails.js
 *
 * 前提:
 *   - ComfyUI が http://127.0.0.1:8188 で起動中（別プロジェクト326/328のサーバーでOK）
 *   - .env に WP_API_URL / WP_USER / WP_APP_PASSWORD
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import axios from 'axios';

const COMFY = {
  url: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
  checkpoint: process.env.COMFYUI_CHECKPOINT || 'animagine-xl-4.0-opt.safetensors',
  width: 1152, height: 648, steps: 25, cfg: 6,
  samplerName: 'euler_ancestral', scheduler: 'normal'
};

const { WP_API_URL, WP_USER, WP_APP_PASSWORD } = process.env;
if (!WP_API_URL || !WP_USER || !WP_APP_PASSWORD) {
  console.error('❌ 環境変数が不足: WP_API_URL, WP_USER, WP_APP_PASSWORD');
  process.exit(1);
}
const AUTH = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
const H = { headers: { Authorization: `Basic ${AUTH}` } };

// ============ ComfyUI 生成（generate-images-comfyui.js と同じ画題） ============
const THEME_MOTIFS = {
  'サンリオ': 'cute white kitten mascot with red ribbon, pastel pink bunny mascot',
  'ちいかわ': 'small round chubby white hamster-like mascot',
  'すみっコぐらし': 'shy round pastel bear and cat mascots',
  'ディズニー': 'magical castle silhouette, sparkling stars',
  'mofusand': 'fluffy kitten mascots in cute costumes'
};

function buildPrompts(title, tagNames) {
  let motif = 'cute pastel animal mascots';
  for (const [k, v] of Object.entries(THEME_MOTIFS)) {
    if (title.includes(k) || tagNames.some(t => t.includes(k))) { motif = v; break; }
  }
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

function buildWorkflow(positive, negative, seed) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: COMFY.checkpoint } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: COMFY.width, height: COMFY.height, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: {
      model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0],
      seed, steps: COMFY.steps, cfg: COMFY.cfg,
      sampler_name: COMFY.samplerName, scheduler: COMFY.scheduler, denoise: 1.0 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'mejirushi-retrofit' } }
  };
}

async function generateViaComfy(positive, negative) {
  const seed = Math.floor(Math.random() * 1e15);
  const { data } = await axios.post(`${COMFY.url}/prompt`, { prompt: buildWorkflow(positive, negative, seed) });
  const promptId = data.prompt_id;
  for (let i = 0; i < 600; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const { data: hist } = await axios.get(`${COMFY.url}/history/${promptId}`);
    const entry = hist[promptId];
    if (entry && entry.status?.completed) {
      const images = Object.values(entry.outputs).flatMap(o => o.images || []);
      if (!images.length) throw new Error('ComfyUI出力に画像がありません');
      const img = images[0];
      const res = await axios.get(`${COMFY.url}/view`, {
        params: { filename: img.filename, subfolder: img.subfolder || '', type: img.type },
        responseType: 'arraybuffer'
      });
      return Buffer.from(res.data);
    }
    if (entry && entry.status?.status_str === 'error') {
      throw new Error('ComfyUI実行エラー');
    }
  }
  throw new Error('ComfyUI生成タイムアウト');
}

// ============ メイン ============
async function main() {
  console.log('[Retrofit] めじるし記事のサムネ後付け開始（ComfyUI・無料）');

  // ComfyUI疎通
  try {
    await axios.get(`${COMFY.url}/system_stats`, { timeout: 5000 });
  } catch {
    console.log(`⏸ ComfyUI未起動のためスキップ（次回実行時に処理）: ${COMFY.url}`);
    return; // launchdからの定期実行を想定し、エラーではなく静かに終了
  }

  // めじるしカテゴリID解決
  const { data: cats } = await axios.get(`${WP_API_URL}/categories`, { params: { slug: 'mejirushi' } });
  if (!cats.length) { console.error('❌ カテゴリ mejirushi が見つかりません'); process.exit(1); }
  const catId = cats[0].id;

  // 対象記事の収集
  const { data: posts } = await axios.get(`${WP_API_URL}/posts`, {
    params: { categories: catId, per_page: 30, _fields: 'id,slug,title,featured_media,tags' }
  });

  const targets = [];
  for (const p of posts) {
    if (!p.featured_media) { targets.push({ ...p, reason: 'アイキャッチなし' }); continue; }
    try {
      const { data: media } = await axios.get(`${WP_API_URL}/media/${p.featured_media}`, { params: { _fields: 'source_url' } });
      if (/-og\.(jpg|jpeg|png|webp|gif)$/i.test(media.source_url || '')) {
        targets.push({ ...p, reason: 'og:image仮アイキャッチ' });
      }
    } catch { /* メディア取得失敗は対象外として続行 */ }
  }

  if (!targets.length) { console.log('[Retrofit] 対象なし（すべてサムネ設定済み）'); return; }
  console.log(`[Retrofit] 対象: ${targets.length}件`);

  for (const post of targets) {
    const title = post.title.rendered.replace(/&#\d+;|&[a-z]+;/g, '');
    console.log(`\n[Retrofit] ${post.slug}（${post.reason}）`);
    console.log(`  記事: ${title}`);

    try {
      // タグ名を取得（モチーフ判定用）
      let tagNames = [];
      if (post.tags?.length) {
        const { data: tags } = await axios.get(`${WP_API_URL}/tags`, {
          params: { include: post.tags.join(','), _fields: 'name' } });
        tagNames = tags.map(t => t.name);
      }

      // 生成 → 文字合成
      const { positive, negative } = buildPrompts(title, tagNames);
      console.log('  🎨 ComfyUIで生成中（2〜8分）...');
      const buf = await generateViaComfy(positive, negative);

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mejirushi-'));
      const rawPath = path.join(tmpDir, 'raw.png');
      const outPath = path.join(tmpDir, 'final.png');
      fs.writeFileSync(rawPath, buf);

      // タイトルから月バッジ・価格を推定
      const monthMatch = title.match(/(\d{1,2})月/);
      const badge = monthMatch ? `${monthMatch[1]}月新作` : '新作';
      const priceMatch = title.match(/(\d{2,4}円)/);
      console.log('  ✏️ 日本語テキスト合成中...');
      execFileSync('python3', [
        'scripts/mejirushi/compose-text.py', rawPath, outPath,
        '--title', 'めじるしアクセサリー',
        '--badge', badge,
        '--price', priceMatch ? priceMatch[1] : ''
      ], { stdio: 'inherit' });

      // WPへアップ → featured_media差し替え
      const imgBuf = fs.readFileSync(outPath);
      const up = await axios.post(`${WP_API_URL}/media`, imgBuf, {
        headers: {
          ...H.headers, 'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${post.slug}-thumb.png"`
        }
      });
      await axios.post(`${WP_API_URL}/posts/${post.id}`, { featured_media: up.data.id }, {
        headers: { ...H.headers, 'Content-Type': 'application/json' } });
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(`  ✅ サムネ後付け完了 (media ${up.data.id})`);
    } catch (e) {
      console.error(`  ⚠️ 失敗（次回実行時に再試行）: ${e.message}`);
    }
  }

  console.log('\n[Retrofit] 完了');
}

main().catch(e => { console.error(e); process.exit(1); });
