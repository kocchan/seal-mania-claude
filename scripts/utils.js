/**
 * 共通ユーティリティ
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ==========================================
// 設定読み込み
// ==========================================

const configPath = path.join(__dirname, '../config.json');
export const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// ==========================================
// 日時ユーティリティ
// ==========================================

const JST_OFFSET = 9 * 60 * 60 * 1000; // +9時間

/**
 * DateオブジェクトをJSTのISO文字列に変換
 * @param {Date} date
 * @returns {string} JST ISO文字列 (例: "2026-04-30T22:36:00.000+09:00")
 */
function toJSTISOString(date) {
  const jstDate = new Date(date.getTime() + JST_OFFSET);
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const y = jstDate.getUTCFullYear();
  const m = pad(jstDate.getUTCMonth() + 1);
  const d = pad(jstDate.getUTCDate());
  const h = pad(jstDate.getUTCHours());
  const min = pad(jstDate.getUTCMinutes());
  const sec = pad(jstDate.getUTCSeconds());
  const ms = pad(jstDate.getUTCMilliseconds(), 3);

  return `${y}-${m}-${d}T${h}:${min}:${sec}.${ms}+09:00`;
}

/**
 * 現在のJST日時をISO文字列で返す
 */
export function getNowJST() {
  return toJSTISOString(new Date());
}

/**
 * 相対時間を実際の日時に変換（JST）
 *
 * @param {string} relativeTime - 相対時間文字列（例: "3分前", "昨日 22:15"）
 * @param {Date} baseTime - 基準となる日時
 * @returns {string|null} JST ISO 8601形式の日時文字列
 */
export function parseRelativeTime(relativeTime, baseTime) {
  if (!relativeTime || !baseTime) return null;

  // "X秒前"
  const secMatch = relativeTime.match(/(\d+)秒前/);
  if (secMatch) {
    const date = new Date(baseTime.getTime() - parseInt(secMatch[1]) * 1000);
    return toJSTISOString(date);
  }

  // "X分前"
  const minMatch = relativeTime.match(/(\d+)分前/);
  if (minMatch) {
    const date = new Date(baseTime.getTime() - parseInt(minMatch[1]) * 60 * 1000);
    return toJSTISOString(date);
  }

  // "X時間前"
  const hourMatch = relativeTime.match(/(\d+)時間前/);
  if (hourMatch) {
    const date = new Date(baseTime.getTime() - parseInt(hourMatch[1]) * 60 * 60 * 1000);
    return toJSTISOString(date);
  }

  // "昨日 HH:MM" または "昨日"
  const yesterdayMatch = relativeTime.match(/昨日\s*(\d{1,2})?:?(\d{2})?/);
  if (yesterdayMatch) {
    // JSTベースで計算
    const jstBase = new Date(baseTime.getTime() + JST_OFFSET);
    jstBase.setUTCDate(jstBase.getUTCDate() - 1);
    if (yesterdayMatch[1] && yesterdayMatch[2]) {
      jstBase.setUTCHours(parseInt(yesterdayMatch[1]), parseInt(yesterdayMatch[2]), 0, 0);
    }
    // JSTからUTCに戻してからJST文字列に変換
    const utcDate = new Date(jstBase.getTime() - JST_OFFSET);
    return toJSTISOString(utcDate);
  }

  // "X日前"
  const dayMatch = relativeTime.match(/(\d+)日前/);
  if (dayMatch) {
    const date = new Date(baseTime.getTime() - parseInt(dayMatch[1]) * 24 * 60 * 60 * 1000);
    return toJSTISOString(date);
  }

  // "M月D日"
  const dateMatch = relativeTime.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    // JSTベースで計算
    const jstBase = new Date(baseTime.getTime() + JST_OFFSET);
    jstBase.setUTCMonth(parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
    jstBase.setUTCHours(0, 0, 0, 0);
    // 未来の日付なら前年
    const jstNow = new Date(baseTime.getTime() + JST_OFFSET);
    if (jstBase > jstNow) {
      jstBase.setUTCFullYear(jstBase.getUTCFullYear() - 1);
    }
    const utcDate = new Date(jstBase.getTime() - JST_OFFSET);
    return toJSTISOString(utcDate);
  }

  // "HH:MM" (今日のJST時刻)
  const timeMatch = relativeTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    // JSTベースで計算
    const jstBase = new Date(baseTime.getTime() + JST_OFFSET);
    jstBase.setUTCHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    const utcDate = new Date(jstBase.getTime() - JST_OFFSET);
    return toJSTISOString(utcDate);
  }

  return null;
}

// ==========================================
// ブラックリスト管理
// ==========================================

const SIGHTINGS_DIR = config.output?.sightingsDir || 'output/sightings';
const BLACKLIST_FILE = path.join(SIGHTINGS_DIR, 'blacklist.json');

/**
 * ブラックリストを読み込む
 * @returns {Map<string, object>} userId -> { reason, createdAt }
 */
export function loadBlacklist() {
  const blacklist = new Map();

  if (!fs.existsSync(BLACKLIST_FILE)) {
    return blacklist;
  }

  try {
    const data = JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf-8'));
    for (const item of data) {
      blacklist.set(item.userId, {
        reason: item.reason,
        createdAt: item.createdAt
      });
    }
  } catch (e) {
    console.warn('[Blacklist] 読み込みエラー:', e.message);
  }

  return blacklist;
}

/**
 * ブラックリストを保存
 * @param {Map<string, object>} blacklist
 */
export function saveBlacklist(blacklist) {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const data = Array.from(blacklist.entries()).map(([userId, info]) => ({
    userId,
    reason: info.reason,
    createdAt: info.createdAt
  }));

  fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(data, null, 2));
}

/**
 * ユーザーをブラックリストに追加
 * @param {Map<string, object>} blacklist
 * @param {string} userId
 * @param {string} reason
 */
export function addToBlacklist(blacklist, userId, reason) {
  console.log(`[AutoBAN] ${userId} (理由: ${reason})`);
  blacklist.set(userId, {
    reason,
    createdAt: getNowJST()
  });
  saveBlacklist(blacklist);
}

// ==========================================
// フィルタリング
// ==========================================

/**
 * ツイートをフィルタリング
 * @param {object} tweet - ツイートデータ
 * @param {Map<string, object>} blacklist - ブラックリスト
 * @param {Set<string>} officialSet - 公式アカウントセット
 * @returns {'pass' | 'exclude' | { action: 'ban', reason: string }}
 */
export function shouldFilterOut(tweet, blacklist, officialSet) {
  // 公式アカウントは除外
  if (officialSet.has(tweet.userId)) {
    return 'exclude';
  }

  // ブラックリストユーザーは除外
  if (blacklist.has(tweet.userId)) {
    return 'exclude';
  }

  // NGワードチェック
  const ngWords = config.filter?.ngWords || [];
  const matchedWord = ngWords.find(word => tweet.text.includes(word));
  if (matchedWord) {
    return { action: 'ban', reason: `NGワード: ${matchedWord}` };
  }

  // NG URLチェック
  const ngUrls = config.filter?.ngUrls || [];
  const matchedUrl = ngUrls.find(url => tweet.text.includes(url));
  if (matchedUrl) {
    return { action: 'ban', reason: `NG URL: ${matchedUrl}` };
  }

  return 'pass';
}

// ==========================================
// データ管理
// ==========================================

/**
 * 日付からファイルパスを取得
 * @param {Date} date
 * @param {string} prefix - ファイル名プレフィックス
 * @returns {string}
 */
export function getFilePath(date, prefix = 'yahoo') {
  const rawDir = config.output?.rawDir || 'output/blog/raw';
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(rawDir, `${prefix}-${dateStr}.json`);
}

/**
 * 既存ファイルからデータを読み込み
 * @param {string} filepath
 * @returns {object|null}
 */
export function loadExistingData(filepath) {
  if (!fs.existsSync(filepath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 既存データからURLセットを取得
 * @param {object|null} existingData
 * @returns {Set<string>}
 */
export function getExistingUrls(existingData) {
  const urls = new Set();
  if (!existingData?.data) return urls;
  for (const tweet of existingData.data) {
    if (tweet.url) urls.add(tweet.url);
  }
  return urls;
}

/**
 * 結果を保存
 * @param {string} filepath
 * @param {object} result
 */
export function saveResult(filepath, result) {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(result, null, 2));
}
