# 画像生成スキル

draftsの記事内容をもとに、Gemini AIでアイキャッチ画像を生成する。

**このスキルの役割**: `output/lottery-info/drafts/` の記事 → 画像生成 → `output/lottery-info/images/` に保存

## 実行方法

```bash
claude "/lotteryinfo-images"
```

## 入力

`output/lottery-info/drafts/{date}/{slug}.md` 内のMarkdownファイル

対象条件:
- frontmatter に `imageGenerated: true` が**ない**もの

## 出力

- 画像: `output/lottery-info/images/{date}/{slug}.png`
- 処理済みフラグ: 対象mdファイルの frontmatter に `imageGenerated: true` を追加

## 処理フロー

### 1. 対象ファイルを検索

```bash
ls output/lottery-info/drafts/
```

各ファイルの frontmatter を確認し、`imageGenerated: true` が**ない**ファイルを対象とする。

### 2. 記事内容からメタデータを抽出

frontmatter から以下を取得:
- `type`: 記事タイプ（lottery, sightingなど）
- `title`: タイトル
- `tags`: タグ配列
- `category`: カテゴリ
- `store`: 店舗名
- `products`: 商品リスト

### 3. 画像生成プロンプトを構築

#### 抽選販売記事（type: lottery）の場合

```
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article about a lottery sale event.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: Soft pastel colors (light pink, light blue, or light yellow) with subtle patterns.

**[Main Elements]**
1. **Product Illustration**: Draw cute "ボンボンドロップシール" (puffy stickers) in the center
2. **Store Name**: "{store}" written in a fun, bold hand-drawn font
3. **Event Badge**: "抽選販売" in a playful banner or ribbon design
4. **Deadline Indicator**: Show urgency with a calendar or clock element

**[Character/Theme]**
- Product theme: {first tag - e.g., ちいかわ, サンリオ, etc.}
- Draw related cute characters or motifs

**[Absolute Rules]**
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS** (puffy seal stickers), not candy
* Make Japanese text clear and readable
* Use warm, inviting colors that appeal to collectors
```

#### 目撃情報記事（type: sighting）の場合

```
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article.
The image conveys a "Breaking News" report about finding a popular item. It should be playful and cute, but NOT overly cluttered.

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Style**: Clean hand-drawn style with colored pencils or markers. A good balance of negative space and cute elements.
* **Background**: A **pale, light shade** based on the region color. You may use a very subtle, soft pattern (like faint polka dots or a light grid), but keep it unobtrusive.

**[Text Elements (Mandatory)]**
1. **"目撃速報" Stamp**:
   * Text: "目撃速報" (Breaking News)
   * Style: Red rubber stamp, tilted diagonally in the **Top Right corner**
2. **Location Name**:
   * Text: "{prefecture}" (Large)
   * Position: Prominently placed near the center or beside the product
   * Style: Fun, bold, hand-drawn font with a soft outline

**[Absolute Rules]**
* Keep the overall design "just right" — neither too empty nor too noisy
* The product is **STICKERS**, not candy
* Ensure the Japanese text is rendered exactly as written
```

#### その他の記事の場合

```
You are a professional illustrator creating a **well-balanced, pop-style hand-drawn illustration** for a web article.
Create an impactful visual that conveys the main point at a glance, without becoming overly cluttered.

**[Absolute Rules]**
1. **One Main Visual**: Pick ONE main point related to the title/content and draw it big in the center
2. **Balanced Details**: Add moderate patterns and cute decorations to make it lively, but keep a good amount of negative space
3. **Minimal Text**: Use very little text (main keywords only)

**[Design Configuration]**
* **Aspect Ratio**: 16:9
* **Touch**: Hand-drawn style (colored pencils, crayons). Warm, cute, "Yume-Kawaii" pop atmosphere
* **Background**: Soft pastel colors with subtle, cute patterns (dots, faint stars)

**[Article Context]**
* **Subject**: "ボンボンドロップシール" refers to popular **puffy stickers** (not candy)
* **Title**: {title}
* **Keywords**: {tags joined by comma}
```

### 4. Gemini APIで画像生成

```javascript
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const imageModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp-image-generation",
    generationConfig: {
        responseModalities: ["IMAGE"]
    }
});

const result = await imageModel.generateContent(prompt);
const response = await result.response;
const part = response.candidates[0].content.parts.find(p => p.inlineData);

if (part && part.inlineData && part.inlineData.data) {
    const buffer = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync(filePath, buffer);
}
```

### 5. 画像を保存

保存先: `output/lottery-info/images/{date}/{slug}.png`

例: `output/lottery-info/images/2026-05-06/partyrico-fujimi-chiikawa.png`

### 6. frontmatterを更新

処理完了後、対象のmdファイルに `imageGenerated: true` を追加:

```yaml
---
type: lottery
status: draft
title: "【5/6締切】ちいかわボンドロ抽選@パーティリコ"
imageGenerated: true  # ← この行を追加
# ... 他のフィールド
---
```

### 7. git commit & push

```bash
git add output/lottery-info/images/ output/lottery-info/drafts/
git commit -m "chore: 画像を生成 [skip ci]"
git push
```

## 地方別カラー設定

目撃情報記事で使用する背景色:

| 地方 | カラー |
|------|--------|
| 北海道・東北 | #4FC3F7 (Light Blue) |
| 関東 | #FF6699 (Pop Pink) |
| 中部 | #FF9800 (Vivid Orange) |
| 近畿 | #BA68C8 (Light Purple) |
| 中国・四国 | #4CAF50 (Flat Green) |
| 九州・沖縄 | #EF5350 (Bright Red) |
| default | #FF6699 |

## 都道府県リスト

```
北海道, 青森, 岩手, 宮城, 秋田, 山形, 福島,
茨城, 栃木, 群馬, 埼玉, 千葉, 東京, 神奈川,
新潟, 富山, 石川, 福井, 山梨, 長野, 岐阜, 静岡, 愛知,
三重, 滋賀, 京都, 大阪, 兵庫, 奈良, 和歌山,
鳥取, 島根, 岡山, 広島, 山口, 徳島, 香川, 愛媛, 高知,
福岡, 佐賀, 長崎, 熊本, 大分, 宮崎, 鹿児島, 沖縄
```

## API制限対策

- 1件処理ごとに1秒待機
- 429エラー発生時は5秒待機してリトライ

```javascript
await new Promise(resolve => setTimeout(resolve, 1000));
```

## 完了メッセージ

```
✅ 画像生成完了: {件数}件

保存先: output/lottery-info/images/
- {ファイル1}
- {ファイル2}

対象のdraftsファイルに imageGenerated: true を追加しました。
```

## エラーハンドリング

- Gemini APIからの画像データがない場合はスキップして次へ
- APIエラー時はログ出力して続行
- 全件処理後にエラー件数を表示

## 入出力まとめ

| 種類 | パス |
|------|------|
| 入力 | `output/lottery-info/drafts/{date}/{slug}.md` |
| 出力（画像） | `output/lottery-info/images/{date}/{slug}.png` |
| 出力（フラグ） | 入力ファイルのfrontmatterに `imageGenerated: true` を追加 |
