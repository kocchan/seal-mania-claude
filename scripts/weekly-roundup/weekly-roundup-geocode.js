/**
 * ジオコーディング（住所 → 緯度経度）モジュール
 *
 * Google Geocoding API を使用。同一住所の再変換コスト削減のためファイルキャッシュ。
 *
 * 使い方:
 *   import { geocodeAddress, buildStaticMapUrl } from './geocode.js';
 *   const { lat, lng } = await geocodeAddress('東京都渋谷区...');
 *   const mapUrl = buildStaticMapUrl([{ lat, lng, label: '1' }, ...]);
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';

const CACHE_PATH = 'output/weekly-roundup/geocode-cache.json';
const API_KEY = process.env.Google_MAP_KEY || process.env.GOOGLE_MAPS_API_KEY;

// =====================================
// キャッシュ
// =====================================
let cache = null;

function loadCache() {
  if (cache) return cache;
  if (fs.existsSync(CACHE_PATH)) {
    try {
      cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
    } catch {
      cache = {};
    }
  } else {
    cache = {};
  }
  return cache;
}

function saveCache() {
  if (!cache) return;
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// =====================================
// 住所を正規化（キャッシュキー用）
// =====================================
function normalizeAddress(address) {
  return (address || '')
    .replace(/[\s　]+/g, ' ')
    .replace(/[\(（].*?[\)）]/g, '')
    .trim();
}

// =====================================
// ジオコーディング
// =====================================
export async function geocodeAddress(address) {
  if (!address) return null;
  const key = normalizeAddress(address);
  if (!key) return null;

  const c = loadCache();
  if (c[key]) return c[key];

  if (!API_KEY) {
    console.warn('[geocode] Google_MAP_KEY 未設定');
    return null;
  }

  try {
    const res = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: key,
        key: API_KEY,
        language: 'ja',
        region: 'jp'
      },
      timeout: 10000
    });
    if (res.data.status === 'OK' && res.data.results?.[0]) {
      const loc = res.data.results[0].geometry.location;
      const result = {
        lat: loc.lat,
        lng: loc.lng,
        formatted: res.data.results[0].formatted_address
      };
      c[key] = result;
      saveCache();
      return result;
    } else if (res.data.status === 'ZERO_RESULTS') {
      c[key] = null; // 見つからなかった結果もキャッシュ（再試行を避ける）
      saveCache();
      return null;
    } else {
      console.warn(`[geocode] APIステータス: ${res.data.status} (${address})`);
      return null;
    }
  } catch (e) {
    console.warn(`[geocode] エラー (${address}): ${e.message}`);
    return null;
  }
}

// =====================================
// 複数住所をまとめて変換
// =====================================
export async function geocodeAddresses(addresses) {
  const results = [];
  for (const addr of addresses) {
    const r = await geocodeAddress(addr);
    results.push({ address: addr, location: r });
    // レート制限対策（50qps制限なのでこれでも余裕）
    await new Promise(r => setTimeout(r, 50));
  }
  return results;
}

// =====================================
// Static Maps URL組み立て
// =====================================
export function buildStaticMapUrl(pins, options = {}) {
  if (!API_KEY) return null;
  if (!pins || pins.length === 0) return null;

  const {
    width = 800,
    height = 400,
    scale = 2,           // 高解像度
    maptype = 'roadmap',
    zoom = null          // 自動
  } = options;

  const params = new URLSearchParams();
  params.set('size', `${width}x${height}`);
  params.set('scale', String(scale));
  params.set('maptype', maptype);
  if (zoom != null) params.set('zoom', String(zoom));
  params.set('language', 'ja');
  params.set('region', 'jp');
  params.set('key', API_KEY);

  // markers の組み立て: 同色の小さい赤ピンを多数
  // ラベルが多すぎる場合（10件以上）は番号なしの色付きドットで表現
  const useLabels = pins.length <= 35; // ラベルA-Z+0-9で35件まで対応
  const labelChars = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  pins.forEach((pin, i) => {
    if (pin.lat == null || pin.lng == null) return;
    let marker;
    if (useLabels && i < labelChars.length) {
      marker = `color:red|label:${labelChars[i]}|${pin.lat},${pin.lng}`;
    } else {
      marker = `color:red|size:small|${pin.lat},${pin.lng}`;
    }
    params.append('markers', marker);
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

// =====================================
// 動的マップ用URL（クリッカブル: Google Maps検索）
// =====================================
export function buildSearchMapUrl(prefName, shopNames) {
  const query = shopNames.length > 0
    ? `${prefName} ${shopNames.slice(0, 5).join(' OR ')}`
    : `${prefName} ボンボンドロップシール`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// =====================================
// インタラクティブマップ埋め込みURL（Maps Embed API search）
// iframeで表示するとピンがタップ可能になり店舗名等が表示される
// =====================================
export function buildEmbedMapUrl({ prefName, areaName, shopNames = [], center = null, zoom = 13 }) {
  if (!API_KEY) return null;
  // 検索クエリ: エリア名 + 県名 + 上位店舗名（3つまで）
  const parts = [];
  if (areaName) parts.push(areaName);
  if (prefName) parts.push(prefName);
  parts.push(...shopNames.slice(0, 3));
  const query = parts.filter(Boolean).join(' ');

  const params = new URLSearchParams();
  params.set('key', API_KEY);
  params.set('q', query || `${prefName || ''} ボンボンドロップシール`);
  if (center) params.set('center', `${center.lat},${center.lng}`);
  params.set('zoom', String(zoom));
  return `https://www.google.com/maps/embed/v1/search?${params.toString()}`;
}
