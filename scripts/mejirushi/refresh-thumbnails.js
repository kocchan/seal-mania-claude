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

// キャラ名 → 専用素材のプレフィックス（generate-images-stock.jsと同一ロジック）
const CHAR_ASSET_MAP = {
  'サンリオ': 'sanrio', 'ちいかわ': 'chiikawa', 'しずくちゃん': 'shizuku',
  'たまごっち': 'tamagotchi', 'ディズニー': 'castle', 'すみっコぐらし': 'sumikko',
  'すみっコ': 'sumikko', 'mofusand': 'mofucat', 'モフサンド': 'mofucat', 'ナガノキャラ': 'nagano'
};

// prefix → サムネに表示するキャラ名（generate-images-stock.jsと同一）
const CHAR_LABELS = {
  sanrio: 'サンリオ', chiikawa: 'ちいかわ', shizuku: 'しずくちゃん', tamagotchi: 'たまごっち',
  castle: 'ディズニー', sumikko: 'すみっコぐらし', mofucat: 'mofusand', nagano: 'ナガノキャラ'
};

// salesDateを解釈して { year, month, day } を返す（generate-images-stock.jsと同一）
function parseSalesDate(salesDate) {
  if (!salesDate) return null;
  let m = salesDate.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (m) return { year: parseInt(m[1]), month: parseInt(m[2]), day: m[3] ? parseInt(m[3]) : null };
  m = salesDate.match(/(?:(\d{4})年)?(\d{1,2})月(?:(\d{1,2})日)?/);
  if (m) return { year: m[1] ? parseInt(m[1]) : null, month: parseInt(m[2]), day: m[3] ? parseInt(m[3]) : null };
  return null;
}

// タイトルの「【7月再販】」「【7月第3週発売】」等から週・発売/再販の別を抽出
function parseTitlePrefix(title) {
  const m = (title || '').match(/(\d{1,2})月(?:第(\d+)週)?(発売|再販)/);
  if (!m) return null;
  return { month: parseInt(m[1]), week: m[2] ? parseInt(m[2]) : null, action: m[3] };
}

function pickDeterministic(slug, pool) {
  const h = crypto.createHash('md5').update(slug).digest();
  return pool[h[0] % pool.length];
}

function detectCharacterPrefix(title, tags) {
  const haystack = [title || '', ...(tags || [])].join(' ');
  for (const [keyword, prefix] of Object.entries(CHAR_ASSET_MAP)) {
    if (haystack.includes(keyword)) return prefix;
  }
  return null;
}

function pickBase(slug, prefix, bases, allFiles) {
  if (prefix) {
    const charPool = allFiles.filter(f => f.startsWith(`char-${prefix}-`));
    if (charPool.length) return pickDeterministic(slug, charPool);
  }
  return pickDeterministic(slug, bases);
}

// ローカルdraftsから該当slugのfrontmatter値を探す
function findDraftMeta(slug) {
  if (!fs.existsSync(DRAFTS_DIR)) return null;
  for (const dateDir of fs.readdirSync(DRAFTS_DIR)) {
    const p = path.join(DRAFTS_DIR, dateDir, `${slug}.md`);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf-8');
      // 値は "2026-07-15" だけでなく "2026年7月" のような日本語表記もあるため、
      // 引用符の中身（または行末まで）をそのまま拾う
      const sales = c.match(/^salesDate:\s*"([^"]*)"/m) || c.match(/^salesDate:\s*(.+)$/m);
      const price = c.match(/^priceRange:\s*"?([^"\n]+)"?/m);
      const tagsBlock = c.match(/^tags:\n((?:\s+-\s+.*\n?)+)/m);
      const tags = tagsBlock ? tagsBlock[1].split('\n').map(l => l.replace(/^\s+-\s+/, '').trim()).filter(Boolean) : [];
      return { salesDate: sales?.[1] || '', priceRange: price?.[1] || '', tags };
    }
  }
  return null;
}

async function main() {
  const onlySlug = process.argv[2] || null;
  console.log('[RefreshThumbs] めじるし記事のサムネ差し替え開始（ストック素材方式）');

  const allFiles = fs.readdirSync(ASSETS_DIR);
  const bases = allFiles.filter(f => /^base-\d+\.png$/.test(f)).sort();
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
      // バッジ（スターバースト）＝ タイトルから抽出した「発売」「再販」の短い語
      // 日付タグ（青ピル）＝ 年月（＋週があれば）。例: "2026年7月" / "2026年7月 第3週"
      const meta = findDraftMeta(post.slug);
      const sd = parseSalesDate(meta?.salesDate);
      const tp = parseTitlePrefix(title);
      const badge = tp ? tp.action : (sd ? `${sd.month}月新作` : '新作');
      const year = sd?.year;
      const month = tp?.month || sd?.month;
      const week = tp?.week;
      const day = sd?.day;
      let date = '';
      if (year && month) {
        date = `${year}年${month}月`;
        if (week) date += ` 第${week}週`;
        else if (day) date = `${year}年${month}/${day}発売`;
      } else if (month) {
        date = week ? `${month}月 第${week}週` : (day ? `${month}/${day}発売` : '');
      }
      let price = '';
      const priceSrc = (meta?.priceRange || '') || (title.match(/(\d{2,4}円)/)?.[1] || '');
      if (priceSrc && priceSrc.length <= 8) price = priceSrc;

      const tags = meta?.tags || [];
      const charPrefix = detectCharacterPrefix(title, tags);
      const characterLabel = charPrefix ? CHAR_LABELS[charPrefix] : '';
      const base = pickBase(post.slug, charPrefix, bases, allFiles);
      console.log(`  🖼️ 素材: ${base} / バッジ: ${badge}${date ? ' / 発売日: ' + date : ''}${price ? ' / 値札: ' + price : ''}${characterLabel ? ' / キャラ: ' + characterLabel : ''}`);

      // 合成
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mejirushi-refresh-'));
      const outPath = path.join(tmpDir, 'thumb.png');
      execFileSync('python3', [
        'scripts/mejirushi/compose-text.py',
        path.join(ASSETS_DIR, base), outPath,
        '--title', 'めじるしアクセサリー',
        '--badge', badge,
        '--price', price,
        '--character', characterLabel,
        '--date', date
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
