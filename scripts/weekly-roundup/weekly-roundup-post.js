/**
 * 目撃情報 週間まとめ記事 WordPress投稿スクリプト
 *
 * output/sightings/weekly-roundups/{week-start}/*.md を WordPress に投稿する。
 *
 * 入力:
 *   - output/sightings/weekly-roundups/{week-start}/*.md（imageGenerated: true && posted: false）
 *   - output/sightings/weekly-roundups/{week-start}/{prefRomaji}.png（アイキャッチ）
 * 出力:
 *   - WordPress記事（公開状態）
 *   - md frontmatter に posted: true / wpPostId / wpPostUrl / postedAt を追加
 *
 * 使い方:
 *   node scripts/sightings/post-weekly-roundup.js
 *   node scripts/sightings/post-weekly-roundup.js --week-start 2026-05-04
 */

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import axios from 'axios';

const ROUNDUPS_DIR = 'output/weekly-roundup';

// =====================================
// 設定読み込み（categoryMap・prefToRegionMap）
// =====================================
const config = JSON.parse(fs.readFileSync('config/sightings.json', 'utf-8'));
const WP_CONFIG = config.wordpress || {};
const WP_CATEGORY_MAP = WP_CONFIG.categoryMap || {};

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
// frontmatterパース
// =====================================
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { frontmatter: {}, body: content };
  const fm = {};
  let currentKey = null, currentArray = null;
  for (const line of m[1].split('\n')) {
    if (/^\s+-\s+/.test(line) && currentArray) {
      currentArray.push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const [, key, value] = kv;
      const v = value.trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        // インライン配列 [1, 2, 3]
        fm[key] = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else if (v === '') {
        fm[key] = [];
        currentArray = fm[key];
      } else {
        fm[key] = v.replace(/^["']|["']$/g, '');
        currentArray = null;
      }
      currentKey = key;
    }
  }
  return { frontmatter: fm, body: content.slice(m[0].length).trim() };
}

// =====================================
// Markdown → HTML変換（簡易、newreleases版を簡略化）
// =====================================
function markdownToHtml(md) {
  let html = md;

  // 1. テーブル変換
  html = html.replace(/(?:^\|.*\|.*\n)+/gm, (table) => {
    const lines = table.trim().split('\n');
    if (lines.length < 2) return table;
    const headers = lines[0].split('|').slice(1, -1).map(s => s.trim());
    const rows = lines.slice(2).map(l => l.split('|').slice(1, -1).map(s => s.trim()));
    let h = '<table style="width:100%; border-collapse:collapse; margin:16px 0;">\n<thead><tr>';
    headers.forEach(c => h += `<th style="border:1px solid #ddd; padding:8px; background:#f7f7f7;">${c}</th>`);
    h += '</tr></thead>\n<tbody>';
    rows.forEach(r => {
      h += '<tr>';
      r.forEach(c => h += `<td style="border:1px solid #ddd; padding:8px;">${convertInline(c)}</td>`);
      h += '</tr>\n';
    });
    h += '</tbody></table>\n';
    return h;
  });

  // 2. 見出し（深い順から処理して衝突回避）
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 3. 区切り線（--- 単独行 → hr）
  html = html.replace(/^---\s*$/gm, '<hr style="border:none; border-top:1px solid #e0e0e0; margin:32px 0;">');

  // 4. リスト
  html = html.replace(/(?:^- .+\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(l => l.replace(/^- /, ''));
    return '<ul>\n' + items.map(i => `  <li>${convertInline(i)}</li>`).join('\n') + '\n</ul>\n';
  });

  // 5. 段落（既存タグは触らない）
  html = html.split(/\n\n+/).map(block => {
    if (block.match(/^<(h[1-6]|ul|ol|table|div|p|blockquote|hr|img|figure|iframe)/)) return block;
    if (!block.trim()) return '';
    return `<p>${convertInline(block.replace(/\n/g, ' '))}</p>`;
  }).join('\n\n');

  return html;
}

function convertInline(text) {
  return text
    // 画像 ![alt](url) — リンクより先に処理
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%; height:auto; display:block; margin:16px auto; border:1px solid #eee;">')
    // 太字
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // リンク
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

// =====================================
// WordPressサービス
// =====================================
class WordPressService {
  constructor() {
    const { WP_API_URL, WP_USER, WP_APP_PASSWORD } = process.env;
    if (!WP_API_URL || !WP_USER || !WP_APP_PASSWORD) {
      throw new Error('❌ 環境変数不足: WP_API_URL, WP_USER, WP_APP_PASSWORD');
    }
    this.apiUrl = WP_API_URL;
    this.auth = Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  }

  async uploadImage(imagePath, slug) {
    if (!imagePath || !fs.existsSync(imagePath)) {
      console.log(`  ⚠️ 画像なし: ${imagePath}`);
      return null;
    }
    try {
      console.log(`  🖼️ 画像アップロード中: ${imagePath}`);
      const buffer = fs.readFileSync(imagePath);
      const res = await axios.post(`${this.apiUrl}/media`, buffer, {
        headers: {
          'Authorization': `Basic ${this.auth}`,
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="${slug}.png"`
        }
      });
      return res.data.id;
    } catch (e) {
      console.error(`  ❌ 画像アップロード失敗: ${e.message}`);
      return null;
    }
  }

  async getOrCreateTag(name) {
    if (!name) return null;
    try {
      const search = await axios.get(`${this.apiUrl}/tags?search=${encodeURIComponent(name)}`, {
        headers: { 'Authorization': `Basic ${this.auth}` }
      });
      const existing = search.data.find(t => t.name === name);
      if (existing) return existing.id;
      const create = await axios.post(`${this.apiUrl}/tags`, { name }, {
        headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json' }
      });
      return create.data.id;
    } catch {
      return null;
    }
  }

  getCategoryIds(prefecture) {
    const ids = [WP_CATEGORY_MAP['都道府県別'] || 862];
    if (!prefecture) return ids;
    const cleanPref = prefecture.replace(/[都府県]$/, '');
    const prefId = WP_CATEGORY_MAP[cleanPref];
    if (prefId) ids.push(prefId);
    return [...new Set(ids.filter(Boolean))];
  }

  // slug で既存記事を検索（更新スタイル: 同slugがあればPUT、なければPOST）
  async findPostBySlug(slug) {
    try {
      const res = await axios.get(`${this.apiUrl}/posts`, {
        params: { slug, status: 'publish,draft,pending,private,future', context: 'edit' },
        headers: { 'Authorization': `Basic ${this.auth}` }
      });
      return res.data?.[0] || null;
    } catch (e) {
      console.error(`  ⚠️ slug検索失敗: ${e.message}`);
      return null;
    }
  }

  async postArticle({ title, slug, htmlContent, mediaId, categories, tagIds }) {
    const payload = {
      title, content: htmlContent, status: 'publish', slug,
      categories, tags: tagIds
    };
    if (mediaId) payload.featured_media = mediaId;

    // 同slugの既存記事があればPUT更新、なければPOST新規作成
    const existing = await this.findPostBySlug(slug);
    try {
      if (existing) {
        console.log(`  🔄 WP更新中 (id=${existing.id}): ${title}`);
        const res = await axios.post(`${this.apiUrl}/posts/${existing.id}`, payload, {
          headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json' }
        });
        return { ...res.data, _action: 'updated' };
      }
      console.log(`  🆕 WP新規投稿中: ${title}`);
      const res = await axios.post(`${this.apiUrl}/posts`, payload, {
        headers: { 'Authorization': `Basic ${this.auth}`, 'Content-Type': 'application/json' }
      });
      return { ...res.data, _action: 'created' };
    } catch (e) {
      console.error(`  ❌ WP投稿失敗: ${e.response?.data?.message || e.message}`);
      return null;
    }
  }
}

// =====================================
// frontmatter更新（posted情報追加）
// =====================================
function updateFrontmatterPosted(filePath, content, wpPostId, wpPostUrl) {
  const now = new Date().toISOString();
  const fields = [
    ['posted', 'true'],
    ['wpPostId', String(wpPostId)],
    ['wpPostUrl', `"${wpPostUrl}"`],
    ['postedAt', `"${now}"`]
  ];
  let updated = content;
  for (const [key, value] of fields) {
    const re = new RegExp(`^${key}:.*$`, 'm');
    if (re.test(updated)) {
      updated = updated.replace(re, `${key}: ${value}`);
    } else {
      updated = updated.replace(/^(---\n)/, `---\n${key}: ${value}\n`);
    }
  }
  fs.writeFileSync(filePath, updated);
}

// =====================================
// メイン
// =====================================
async function main() {
  console.log('[WeeklyRoundupPost] 投稿開始');
  if (!fs.existsSync(ROUNDUPS_DIR)) {
    console.log('[WeeklyRoundupPost] 出力ディレクトリなし');
    return;
  }

  const args = parseArgs();
  const weekDirs = args.weekStart ? [args.weekStart] : fs.readdirSync(ROUNDUPS_DIR)
    .filter(d => fs.statSync(path.join(ROUNDUPS_DIR, d)).isDirectory());

  const wp = new WordPressService();
  let totalPosted = 0, totalSkipped = 0;
  const postedThisRun = [];

  for (const weekDir of weekDirs) {
    const weekPath = path.join(ROUNDUPS_DIR, weekDir);
    if (!fs.existsSync(weekPath)) continue;

    const files = fs.readdirSync(weekPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(weekPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      if (frontmatter.posted === 'true' || frontmatter.posted === true) {
        totalSkipped++;
        continue;
      }
      if (frontmatter.imageGenerated !== 'true' && frontmatter.imageGenerated !== true) {
        console.log(`  ⏭️ 画像未生成のためスキップ: ${file}`);
        continue;
      }

      const slug = file.replace('.md', '');
      console.log(`\n[WeeklyRoundupPost] 処理中: ${weekDir}/${slug}`);

      // アイキャッチ
      const imagePath = path.join(weekPath, `${slug}.png`);
      const mediaId = await wp.uploadImage(imagePath, frontmatter.slug || slug);

      // Markdown → HTML
      const htmlContent = markdownToHtml(body);

      // カテゴリ
      const categories = wp.getCategoryIds(frontmatter.prefecture);

      // タグ（週間まとめ + 都道府県名）
      const tagNames = ['週間まとめ', frontmatter.prefecture, 'ボンボンドロップシール'].filter(Boolean);
      const tagIds = [];
      for (const tn of [...new Set(tagNames)]) {
        const id = await wp.getOrCreateTag(tn);
        if (id) tagIds.push(id);
      }

      // 投稿
      const result = await wp.postArticle({
        title: frontmatter.title,
        slug: frontmatter.slug || slug,
        htmlContent,
        mediaId,
        categories,
        tagIds
      });

      if (result?.id) {
        updateFrontmatterPosted(filePath, content, result.id, result.link);
        totalPosted++;
        const actionLabel = result._action === 'updated' ? '🔄 更新完了' : '✅ 新規投稿完了';
        console.log(`  ${actionLabel}: ${result.link}`);
        postedThisRun.push({
          weekDir,
          slug,
          wpPostId: result.id,
          wpPostUrl: result.link,
          action: result._action,
          prefecture: frontmatter.prefecture,
          includedSightingIds: (frontmatter.includedSightingIds || []).map(Number).filter(Boolean)
        });
      }

      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('\n========================================');
  console.log(`[WeeklyRoundupPost] 完了: 投稿 ${totalPosted}件 / スキップ ${totalSkipped}件`);

  // 投稿結果を記録（Phase 3で参照）
  if (postedThisRun.length > 0) {
    const logPath = path.join(ROUNDUPS_DIR, '_last-posted.json');
    fs.writeFileSync(logPath, JSON.stringify(postedThisRun, null, 2));
    console.log(`[WeeklyRoundupPost] 投稿ログ保存: ${logPath}`);
  }
}

main().catch(err => {
  console.error('[WeeklyRoundupPost] エラー:', err);
  process.exit(1);
});
