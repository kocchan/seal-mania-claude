# めじるしサムネの「ストック素材＋文字合成」方式

2026-07-20 導入（ユーザー発案）。めじるし新作記事のアイキャッチを
「事前生成した使い回し素材＋記事ごとの文字合成」で作る。
生成APIを毎回呼ばないため運用コスト0円・GitHub Actionsで完結する。

## 仕組み

```
[1回だけ] npm run mejirushi:base-assets
   Gemini(gemini-3.1-flash-image-preview)で高品質ベース画像を5枚生成
   → assets/mejirushi-thumbs/base-01..05.png（git管理）
   ・文字なし／特定キャラなし（猫・うさぎ・くま等のジェネリック動物）
   ・上部22%はタイトル用、右上はバッジ用に空けた構図

[毎日・CI内] post-wordpress.yml
   npm run mejirushi:images  … drafts走査 → slugのハッシュで素材を決定的に選択
                               → compose-text.py で文字合成 → images/{date}/{slug}.png
   npm run mejirushi:post    … アイキャッチ付きで投稿
```

## 文字合成（scripts/mejirushi/compose-text.py）

- タイトル「めじるしアクセサリー」…白ふち＋ピンク。バッジと重なる場合は自動縮小・左シフト
- バッジ「◯月新作」…右上の黄色スターバースト（salesDateから自動）
- 値札「300円」…左下（priceRangeが8文字以内のときのみ）
- フォントは同梱の assets/fonts/ZenMaruGothic-Bold.ttf（OFL）を使用し、CI/ローカルで同一の見た目

## 素材の追加・差し替え

```bash
node scripts/mejirushi/generate-base-assets.js     # 全5枚
node scripts/mejirushi/generate-images.js 3        # base-03のみ再生成
```
生成後、良品を確認して git commit するだけで以後の記事に反映される。

## 経緯（採用しなかった案）

- Gemini毎回生成（〜2026-07-20）: 高品質だが画像1枚6〜20円
- ComfyUI(SDXL/animagine)ローカル生成: 0円だが商品コンセプト
  （傘・ボトルに付くチャーム）を描き分けられず品質不足で廃止。
  抽選・新作販売・週間まとめの3系統は引き続きGemini生成。
