/**
 * 個別目撃情報記事 → 週間まとめ記事への内部リンク挿入
 *
 * 投稿済みの週間まとめ記事（output/sightings/weekly-roundups/{week-start}/{prefRomaji}.md）の
 * `includedSightingIds` を参照し、対応する個別目撃記事の WordPress content を更新して
 * 「今週のまとめ記事へのリンク」をHTMLマーカーで挿入する（冪等）。
 *
 * 入力:
 *   - 投稿済み週間まとめmd（posted: true && wpPostUrl あり）
 * 処理:
 *   - 各 includedSightingIds に対して GET /posts/{id} → contentにマーカー差し替え/追加 → PUT
 *
 * 使い方:
 *   node scripts/sightings/link-sightings-to-roundup.js
 *   node scripts/sightings/link-sightings-to-roundup.js --week-start 2026-05-04
 */

import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import axios from 'axios';

const ROUNDUPS_DIR = 'output/weekly-roundup';
const MARKER_START = '<!-- weekly-roundup-link:start -->';
const MARKER_END = '<!-- weekly-roundup-link:end -->';

// =====================================
// 引数パース
// =====================================
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { weekStart: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--week-start' && args[i + 1]) out.weekStart = args[++i];
    if (args[i] === '--dry-run') out.dryRun = true;
  }
  return out;
}

// =====================================
// frontmatterパース
// =====================================
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { frontmatter: {} };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        fm[kv[1]] = v.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else {
        fm[kv[1]] = v.replace(/^["']|["']$/g, '');
      }
    }
  }
  return { frontmatter: fm };
}

// =====================================
// 週ラベル「2026年5月第1週」を計算
// =====================================
function weekLabel(weekStart) {
  const [y, m, d] = weekStart.split('-').map(Number);
  const monthFirst = new Date(Date.UTC(y, m - 1, 1));
  const monthFirstDow = monthFirst.getUTCDay();
  const monthFirstMonday = (monthFirstDow === 1) ? 1 : (monthFirstDow === 0 ? 2 : 9 - monthFirstDow);
  const weekNum = Math.floor((d - monthFirstMonday) / 7) + 1;
  const weekStr = ['第1週', '第2週', '第3週', '第4週', '第5週'][Math.max(0, Math.min(4, weekNum - 1))];
  return `${y}年${m}月${weekStr}`;
}

// =====================================
// リンクブロックHTML生成
// 週間まとめURLは固定（常に最新週を表示）なので、件数や週ラベルは含めず常設文言にする
// =====================================
function buildLinkBlock({ prefecture, roundupUrl }) {
  return `${MARKER_START}
<div style="border:2px solid #ff6699; border-radius:8px; padding:16px; background:#fff5f8; margin:30px 0; box-sizing:border-box;">
  <p style="margin:0 0 8px; font-weight:bold; font-size:16px;">🗓 ${prefecture}の週間目撃情報まとめ</p>
  <p style="margin:0 0 12px; font-size:14px; color:#444;">${prefecture}でのボンボンドロップシール目撃情報を地区別・店舗別にまとめた最新週レポートを公開しています。注目店舗や攻略法もチェックしてみてください。</p>
  <a href="${roundupUrl}" style="display:inline-block; padding:10px 18px; background:#ff6699; color:#fff; text-decoration:none; border-radius:4px; font-weight:bold;">▶ ${prefecture}の目撃情報まとめを見る</a>
</div>
${MARKER_END}`;
}

// =====================================
// content にリンクブロックを挿入（冪等）
// =====================================
function insertOrReplaceLinkBlock(content, block) {
  const re = new RegExp(`${MARKER_START}[\\s\\S]*?${MARKER_END}`, 'g');
  if (re.test(content)) {
    return content.replace(re, block);
  }
  return content.trimEnd() + '\n\n' + block + '\n';
}

// =====================================
// WordPress クライアント
// =====================================
class WPClient {
  constructor() {
    const { WP_API_URL, WP_USER, WP_APP_PASSWORD } = process.env;
    if (!WP_API_URL || !WP_USER || !WP_APP_PASSWORD) {
      throw new Error('❌ 環境変数不足: WP_API_URL, WP_USER, WP_APP_PASSWORD');
    }
    this.apiUrl = WP_API_URL;
    this.headers = {
      'Authorization': `Basic ${Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'application/json'
    };
  }

  async getPost(id) {
    const res = await axios.get(`${this.apiUrl}/posts/${id}?context=edit`, { headers: this.headers });
    return res.data;
  }

  async updatePost(id, content) {
    const res = await axios.post(`${this.apiUrl}/posts/${id}`, { content }, { headers: this.headers });
    return res.data;
  }
}

// =====================================
// 投稿済み週間まとめ記事の収集
// =====================================
function collectPostedRoundups(weekStart) {
  if (!fs.existsSync(ROUNDUPS_DIR)) return [];
  const weekDirs = weekStart
    ? [weekStart]
    : fs.readdirSync(ROUNDUPS_DIR).filter(d => fs.statSync(path.join(ROUNDUPS_DIR, d)).isDirectory());

  const out = [];
  for (const weekDir of weekDirs) {
    const weekPath = path.join(ROUNDUPS_DIR, weekDir);
    if (!fs.existsSync(weekPath)) continue;
    const files = fs.readdirSync(weekPath).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(weekPath, file), 'utf-8');
      const { frontmatter } = parseFrontmatter(content);
      if (frontmatter.posted !== 'true' && frontmatter.posted !== true) continue;
      if (!frontmatter.wpPostUrl) continue;
      out.push({
        weekDir,
        prefecture: frontmatter.prefecture,
        roundupUrl: frontmatter.wpPostUrl,
        weekStart: frontmatter.weekStart,
        totalCount: parseInt(frontmatter.totalCount, 10) || 0,
        includedSightingIds: (frontmatter.includedSightingIds || []).map(Number).filter(Boolean)
      });
    }
  }
  return out;
}

// =====================================
// メイン
// =====================================
async function main() {
  const args = parseArgs();
  const wp = new WPClient();
  const roundups = collectPostedRoundups(args.weekStart);

  console.log(`[LinkBack] 対象の週間まとめ記事: ${roundups.length}件${args.dryRun ? ' (dry-run)' : ''}`);
  if (roundups.length === 0) {
    console.log('[LinkBack] 投稿済みの週間まとめがありません');
    return;
  }

  let updated = 0, skipped = 0, errors = 0;

  for (const r of roundups) {
    console.log(`\n=== ${r.prefecture}（${r.weekDir}, ${r.includedSightingIds.length}件）===`);
    const block = buildLinkBlock(r);

    for (const sightingId of r.includedSightingIds) {
      try {
        const post = await wp.getPost(sightingId);
        const currentContent = post.content?.raw || post.content?.rendered || '';
        if (!currentContent) {
          console.log(`  ⚠️ #${sightingId} content取得失敗`);
          errors++;
          continue;
        }
        const newContent = insertOrReplaceLinkBlock(currentContent, block);
        if (newContent === currentContent) {
          console.log(`  = #${sightingId} 既に最新（変更なし）`);
          skipped++;
          continue;
        }
        if (args.dryRun) {
          console.log(`  [dry-run] #${sightingId} 更新予定`);
          updated++;
        } else {
          await wp.updatePost(sightingId, newContent);
          console.log(`  ✓ #${sightingId} 更新完了`);
          updated++;
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.log(`  ✗ #${sightingId} エラー: ${e.response?.status || ''} ${e.message}`);
        errors++;
      }
    }
  }

  console.log('\n========================================');
  console.log(`[LinkBack] 完了: 更新 ${updated}件 / スキップ ${skipped}件 / エラー ${errors}件`);
}

main().catch(err => {
  console.error('[LinkBack] エラー:', err);
  process.exit(1);
});
