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

// キャラ名 → 専用素材のプレフィックス（assets/mejirushi-thumbs/char-{key}-*.png）
// タイトル/タグにキーがヒットしたら、その専用素材群から優先的に選ぶ
const CHAR_ASSET_MAP = {
  'サンリオ': 'sanrio',
  'ちいかわ': 'chiikawa',
  'しずくちゃん': 'shizuku',
  'たまごっち': 'tamagotchi',
  'ディズニー': 'castle',
  'すみっコぐらし': 'sumikko',
  'すみっコ': 'sumikko',
  'mofusand': 'mofucat',
  'モフサンド': 'mofucat',
  'ナガノキャラ': 'nagano'
};

// prefix → サムネに表示するキャラ名（表記ゆれを吸収した正式表記）
const CHAR_LABELS = {
  sanrio: 'サンリオ',
  chiikawa: 'ちいかわ',
  shizuku: 'しずくちゃん',
  tamagotchi: 'たまごっち',
  castle: 'ディズニー',
  sumikko: 'すみっコぐらし',
  mofucat: 'mofusand',
  nagano: 'ナガノキャラ'
};

// slugから決定的に1枚選ぶ（同じslugなら常に同じ絵＝冪等）
function pickDeterministic(slug, pool) {
  const h = crypto.createHash('md5').update(slug).digest();
  return pool[h[0] % pool.length];
}

// タイトル/タグからキャラのprefixを判定（見つからなければnull）
function detectCharacterPrefix(title, tags) {
  const haystack = [title || '', ...(tags || [])].join(' ');
  for (const [keyword, prefix] of Object.entries(CHAR_ASSET_MAP)) {
    if (haystack.includes(keyword)) return prefix;
  }
  return null;
}

// キャラが判定できれば専用素材群から、できなければ汎用baseから選ぶ
function pickBase(slug, prefix, bases, allFiles) {
  if (prefix) {
    const charPool = allFiles.filter(f => f.startsWith(`char-${prefix}-`));
    if (charPool.length) return pickDeterministic(slug, charPool);
  }
  return pickDeterministic(slug, bases);
}

function main() {
  console.log('[Images/Stock] めじるしアイキャッチ生成開始（ストック素材＋文字合成・0円）');

  const allFiles = fs.existsSync(CONFIG.assetsDir) ? fs.readdirSync(CONFIG.assetsDir) : [];
  const bases = allFiles.filter(f => /^base-\d+\.png$/.test(f)).sort();
  const charFiles = allFiles.filter(f => /^char-[a-z]+-\d+\.png$/.test(f));
  if (!bases.length) {
    console.error(`❌ ベース素材がありません: ${CONFIG.assetsDir}/base-*.png`);
    process.exit(1);
  }
  console.log(`[Images/Stock] 汎用素材: ${bases.length}枚 / キャラ専用素材: ${charFiles.length}枚`);

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
      const m = (frontmatter.salesDate || '').match(/^\d{4}-(\d{2})-(\d{2})/);
      const badge = m ? `${parseInt(m[1])}月新作` : '新作';
      // 発売日タグ（例: 7/15発売）。日付が無ければ表示しない
      const date = m ? `${parseInt(m[1])}/${parseInt(m[2])}発売` : '';
      // priceRange 例: "300円" / "300〜400円" → 短い表記だけ値札にする
      const price = (frontmatter.priceRange || '').length <= 8 ? (frontmatter.priceRange || '') : '';

      const title = frontmatter.title || '';
      const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
      const charPrefix = detectCharacterPrefix(title, tags);
      const characterLabel = charPrefix ? CHAR_LABELS[charPrefix] : '';
      const base = pickBase(slug, charPrefix, bases, allFiles);
      console.log(`  🖼️ 素材: ${base} / バッジ: ${badge}${date ? ' / 発売日: ' + date : ''}${price ? ' / 値札: ' + price : ''}${characterLabel ? ' / キャラ: ' + characterLabel : ''}`);

      try {
        execFileSync('python3', [
          'scripts/mejirushi/compose-text.py',
          path.join(CONFIG.assetsDir, base), outputPath,
          '--title', 'めじるしアクセサリー',
          '--badge', badge,
          '--price', price,
          '--character', characterLabel,
          '--date', date
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
