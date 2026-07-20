/**
 * WordPress上の既存めじるし記事のアイキャッチを「ストック素材＋文字合成」で作り直して差し替える
 *
 * 用途:
 *   - 過去記事のサムネを新方式に揃える
 *   - ベース素材(assets/mejirushi-thumbs/)を追加・差し替えた後の一括リフレッシュ
 *
 * 使い方:
 *   node scripts/mejirushi/refresh-thumbnails.js              # めじるしカテゴリ全記事
 *   node scripts/mejirushi/refresh-thumbnails.js {slug}      # 特定記事のみ
 *
 * 文字情報の取得元:
 *   1. ローカルの drafts（output/mejirushi/drafts/【日付】/{slug}.md の salesDate / priceRange）
 *   2. 見つからなければ記事タイトルから推定（「◯月」「◯◯円」）
 */

import 'dotenv/config';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import axios from 'axios';

const ASSETS_DIR = 'assets/mejirushi-thumbs';
const DRAFTS_DIR = 'output/mejirushi/drafts';

const { WP_API_URL, WP_USER, WP_APP_PASSWORD } = process.env;
if (!WP_API_URL || !WP_USER || !WP_APP_PASSWORD) {
  console.error('❌ 環境変数が不足: WP_API_URL, WP_USER, WP_APP_PASSWORD');
  process.exit(1);
}
const AUTH = { headers: { Authorization: `Basic ${Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')}` } };

// slugから決定的にベース素材を選ぶ（generate-images-stock.jsと同一ロジック）
function pickBase(slug, bases) {
  const h = crypto.createHash('md5').update(slug).digest();
  return bases[h[0] % bases.length];
}

// ローカルdraftsから該当slugのfrontmatter値を探す
function findDraftMeta(slug) {
  if (!fs.existsSync(DRAFTS_DIR)) return null;
  for (const dateDir of fs.readdirSync(DRAFTS_DIR)) {
    const p = path.join(DRAFTS_DIR, dateDir, `${slug}.md`);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf-8');
      const sales = c.match(/^salesDate:\s*"?([\d-]+)"?/m);
      const price = c.match(/^priceRange:\s*"?([^"\n]+)"?/m);
      return { salesDate: sales?.[1] || '', priceRange: price?.[1] || '' };
    }
  }
  return null;
}

async function main() {
  const onlySlug = process.argv[2] || null;
  console.log('[RefreshThumbs] めじるし記事のサムネ差し替え開始（ストック素材方式）');

  const bases = fs.readdirSync(ASSETS_DIR).filter(f => /^base-\d+\.png$/.test(f)).sort();
  if (!bases.length) { console.error('❌ ベース素材がありません'); process.exit(1); }

  // めじるしカテゴリID → 記事一覧
  const { data: cats } = await axios.get(`${WP_API_URL}/categories`, { params: { slug: 'mejirushi' } });
  if (!cats.length) { console.error('❌ カテゴリ mejirushi が見つかりません'); process.exit(1); }
  const { data: posts } = await axios.get(`${WP_API_URL}/posts`, {
    params: { categories: cats[0].id, per_page: 50, _fields: 'id,slug,title,featured_media' }
  });

  const targets = onlySlug ? posts.filter(p => p.slug === onlySlug) : posts;
  if (!targets.length) { console.log('[RefreshThumbs] 対象なし'); return; }
  console.log(`[RefreshThumbs] 対象: ${targets.length}件`);

  for (const post of targets) {
    const title = post.title.rendered.replace(/&#\d+;|&[a-z]+;/g, '');
    console.log(`\n[RefreshThumbs] ${post.slug}`);
    console.log(`  記事: ${title}`);

    try {
      // 文字情報: drafts優先 → タイトルから推定
      const meta = findDraftMeta(post.slug);
      let badge = '新作';
      let price = '';
      if (meta?.salesDate) {
        const m = meta.salesDate.match(/^\d{4}-(\d{2})/);
        if (m) badge = `${parseInt(m[1])}月新作`;
      } else {
        const m = title.match(/(\d{1,2})月/);
        if (m) badge = `${m[1]}月新作`;
      }
      const priceSrc = (meta?.priceRange || '') || (title.match(/(\d{2,4}円)/)?.[1] || '');
      if (priceSrc && priceSrc.length <= 8) price = priceSrc;

      const base = pickBase(post.slug, bases);
      console.log(`  🖼️ 素材: ${base} / バッジ: ${badge}${price ? ' / 値札: ' + price : ''}`);

      // 合成
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mejirushi-refresh-'));
      const outPath = path.join(tmpDir, 'thumb.png');
      execFileSync('python3', [
        'scripts/mejirushi/compose-text.py',
        path.join(ASSETS_DIR, base), outPath,
        '--title', 'めじるしアクセサリー',
        '--badge', badge,
        '--price', price
      ], { stdio: 'inherit' });

      // アップロード → featured差し替え
      const up = await axios.post(`${WP_API_URL}/media`, fs.readFileSync(outPath), {
        headers: {
          ...AUTH.headers, 'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${post.slug}-stock.png"`
        }
      });
      await axios.post(`${WP_API_URL}/posts/${post.id}`, { featured_media: up.data.id }, {
        headers: { ...AUTH.headers, 'Content-Type': 'application/json' } });
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(`  ✅ 差し替え完了 (media ${up.data.id} / 旧: ${post.featured_media || 'なし'})`);
    } catch (e) {
      console.error(`  ⚠️ 失敗: ${e.response?.data?.message || e.message}`);
    }
  }

  console.log('\n[RefreshThumbs] 完了');
}

main().catch(e => { console.error(e); process.exit(1); });
