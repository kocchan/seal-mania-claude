/**
 * 時間変換ユーティリティ
 *
 * 相対時間を実際の日時に変換する
 */

/**
 * 相対時間を実際の日時に変換
 *
 * @param {string} relativeTime - 相対時間文字列（例: "3分前", "昨日 22:15"）
 * @param {Date} baseTime - 基準となる日時（JSONのtimestampフィールドの値）
 * @returns {string|null} ISO 8601形式の日時文字列
 *
 * @example
 * parseRelativeTime("9分前", new Date("2026-04-29T14:28:10.561Z"))
 * // => "2026-04-29T14:19:10.561Z"
 */
export function parseRelativeTime(relativeTime, baseTime) {
  if (!relativeTime || !baseTime) return null;

  // "X秒前"
  const secMatch = relativeTime.match(/(\d+)秒前/);
  if (secMatch) {
    const date = new Date(baseTime.getTime() - parseInt(secMatch[1]) * 1000);
    return date.toISOString();
  }

  // "X分前"
  const minMatch = relativeTime.match(/(\d+)分前/);
  if (minMatch) {
    const date = new Date(baseTime.getTime() - parseInt(minMatch[1]) * 60 * 1000);
    return date.toISOString();
  }

  // "X時間前"
  const hourMatch = relativeTime.match(/(\d+)時間前/);
  if (hourMatch) {
    const date = new Date(baseTime.getTime() - parseInt(hourMatch[1]) * 60 * 60 * 1000);
    return date.toISOString();
  }

  // "昨日 HH:MM"
  const yesterdayMatch = relativeTime.match(/昨日\s*(\d{1,2}):(\d{2})/);
  if (yesterdayMatch) {
    const date = new Date(baseTime);
    date.setDate(date.getDate() - 1);
    date.setHours(parseInt(yesterdayMatch[1]), parseInt(yesterdayMatch[2]), 0, 0);
    return date.toISOString();
  }

  // "M月D日"
  const dateMatch = relativeTime.match(/(\d{1,2})月(\d{1,2})日/);
  if (dateMatch) {
    const date = new Date(baseTime);
    date.setMonth(parseInt(dateMatch[1]) - 1, parseInt(dateMatch[2]));
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }

  // "HH:MM" (今日)
  const timeMatch = relativeTime.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const date = new Date(baseTime);
    date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    return date.toISOString();
  }

  return null;
}
