/**
 * めじるしアクセサリー新作記事のアイキャッチを「ストック素材＋文字合成」で作る
 *
 * ストック素材方式（2026-07-20 ユーザー発案）:
 *   Geminiで事前生成した高品質ベース画像（assets/mejirushi-thumbs/base-*.png・
 *   文字なし・ジェネリック動物のみ）から1枚選び、記事ごとの文字
 *   （タイトル / ◯月新作 / 価格）だけをPillowで合成する。
 *   → 運用コスト0円・API不要・GitHub Actionsで完結（ComfyUI/ローカルMac不要）
 *
 * 使い方:
 *   node scripts/mejirushi/generate-images-stock.js
 *
 * 入力:  output/mejirushi/drafts/{date}/{slug}.md
 * 出力:  output/mejirushi/images/{date}/{slug}.png（1200x675）
 * フラグ: imageGenerated（Gemini版と同じ・冪等）
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const CONFIG = {
  draftsDir: 'output/mejirushi/drafts',
  imagesDir: 'output/mejirushi/images',
  assetsDir: 'assets/mejirushi-thumbs'
};

// =====================================
// frontmatter パーサー（他スクリプトと同じ簡易版）
// =====================================
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {} };
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

// slugから決定的にベース素材を選ぶ（再実行しても同じ絵＝冪等）
function pickBase(slug, bases) {
  const h = crypto.createHash('md5').update(slug).digest();
  return bases[h[0] % bases.length];
}

function main() {
  console.log('[Images/Stock] めじるしアイキャッチ生成開始（ストック素材＋文字合成・0円）');

  const bases = fs.existsSync(CONFIG.assetsDir)
    ? fs.readdirSync(CONFIG.assetsDir).filter(f => /^base-\d+\.png$/.test(f)).sort()
    : [];
  if (!bases.length) {
    console.error(`❌ ベース素材がありません: ${CONFIG.assetsDir}/base-*.png`);
    process.exit(1);
  }
  console.log(`[Images/Stock] ベース素材: ${bases.length}枚`);

  if (!fs.existsSync(CONFIG.draftsDir)) {
    console.log('[Images/Stock] draftsディレクトリが見つかりません');
    return;
  }

  let generated = 0, skipped = 0;
  for (const dateDir of fs.readdirSync(CONFIG.draftsDir)) {
    const datePath = path.join(CONFIG.draftsDir, dateDir);
    if (!fs.statSync(datePath).isDirectory()) continue;

    for (const file of fs.readdirSync(datePath).filter(f => f.endsWith('.md'))) {
      const filePath = path.join(datePath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { frontmatter } = parseFrontmatter(content);

      if (frontmatter.imageGenerated === 'true' || frontmatter.posted === 'true') { skipped++; continue; }

      const slug = file.replace('.md', '');
      console.log(`\n[Images/Stock] 処理中: ${dateDir}/${slug}`);

      const outputDir = path.join(CONFIG.imagesDir, dateDir);
      fs.mkdirSync(outputDir, { recursive: true });
      const outputPath = path.join(outputDir, `${slug}.png`);

      // 文字要素を frontmatter から決定
      const m = (frontmatter.salesDate || '').match(/^\d{4}-(\d{2})/);
      const badge = m ? `${parseInt(m[1])}月新作` : '新作';
      // priceRange 例: "300円" / "300〜400円" → 短い表記だけ値札にする
      const price = (frontmatter.priceRange || '').length <= 8 ? (frontmatter.priceRange || '') : '';

      const base = pickBase(slug, bases);
      console.log(`  🖼️ 素材: ${base} / バッジ: ${badge}${price ? ' / 値札: ' + price : ''}`);

      try {
        execFileSync('python3', [
          'scripts/mejirushi/compose-text.py',
          path.join(CONFIG.assetsDir, base), outputPath,
          '--title', 'めじるしアクセサリー',
          '--badge', badge,
          '--price', price
        ], { stdio: 'inherit' });

        // フラグ更新
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
        console.error(`  ⚠️ 合成失敗（投稿はog:image→なしにフォールバック）: ${e.message}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`[Images/Stock] 完了: 生成 ${generated}件 / スキップ ${skipped}件`);
}

main();
