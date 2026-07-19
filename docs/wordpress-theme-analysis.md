# WordPress テーマ（デザイン）構造分析

seal-search.com のフロント側デザインがどこにどう書かれているかの調査メモ。

- 調査日: 2026-07-18
- 対象サーバー: ConoHa WING（`public_html/seal-search.com/`）
- テーマ: **Cocoon**（親 `cocoon-master` ＋ 子テーマ `cocoon-child-master`）
- 解析元ファイル: `output/wordpress/theme/cocoon-child-master/`（子テーマを丸ごとダウンロードしたもの。2026-07-19にリファクタで現パスへ移動・git追跡中）

> ⚠️ このリポジトリ（seal-mania-claude）にはサイトのデザインは含まれない。デザインは全て
> WordPressサーバー側（子テーマ or 管理画面のDB）にある。編集は WP File Manager プラグイン、
> ConoHa ファイルマネージャー、または FTP から行う。

---

## 全体像：CSSが3箇所に分散した「継ぎ足し」構造

本来CSSを書くべき子テーマの `style.css` は**空**で、実際のスタイルは3箇所にバラバラに存在する。
これが「どこを触ればいいか分かりにくい」最大の原因。

| CSSの置き場所 | 中身 | 編集方法 |
|---|---|---|
| 各PHPテンプレート内の `<style>` 直書き | front-page / category / page-map / page-calendar / single-custom-map それぞれの見た目 | 該当PHPを直接編集 |
| カスタマイザーの追加CSS（約14KB） | サイト全体の共通スタイル・余白リセット | 外観 > カスタマイズ > 追加CSS |
| Cocoon設定（GUI） | 色・ヘッダー・フォント等（`cocoon-style-inline-css` として出力・約126KB） | 管理画面 > Cocoon設定 |
| 子テーマ `style.css` | **空（デフォルトのまま）** | ― |

トップページは固定ページ（ページID 33）に紐づくが、**本文は空**。実際の表示は
`front-page.php` テンプレートが担っている（静的フロントページでは front-page.php が最優先）。

---

## ファイル別の役割

対象ディレクトリ: `wp-content/themes/cocoon-child-master/`

### デザインの中核

| ファイル | 行数 | 何を表示 | 要点 |
|---|---|---|---|
| `front-page.php` | 502 | **トップページ全体** | 後述の8ブロック。`<style>` と `<script>` も内包 |
| `functions.php` | 176 | ※デザインではない | **カテゴリ自動生成**が主。⚠️問題あり（後述） |

#### `front-page.php` のセクション構成（上から順）

1. キービジュアル（PC/スマホで画像2枚を出し分け）
2. 人気記事スライダー（`views` メタ数トップ5・横スクロール＋ドットインジケーター）
3. **商品カード**（ちいかわ商品・Amazon / 楽天 / Yahoo ボタン）
4. 場所から探す（6地域 × 各4件）
5. 店舗から探す（ドンキ / LOFT / ハンズ … 7店舗）
6. キャラクターから探す（ディズニー / サンリオ … 6キャラ）
7. 入荷/抽選情報（今月の新作 / 抽選・予約 / オンライン通販）
8. 豆知識（`guide` カテゴリ 4件）

ページ末尾に `<style>`（グリッド・スライダーCSS、320行目〜）と `<script>`（スライダーのドット制御、474行目〜）を直書き。

### 個別ページのテンプレート

| ファイル | 行数 | 担当 | 特徴 |
|---|---|---|---|
| `category.php` | 278 | カテゴリ一覧（都道府県別など） | サイドバー非表示・グリッド・ページネーションの独自装飾 |
| `page-map.php` | 284 | 固定ページ「トレンド在庫マップ」 | 都道府県ボタン→カテゴリへリダイレクト＋目撃速報リスト（`cat-sighting`） |
| `page-calendar.php` | 264 | 固定ページ「カレンダー」 | `cat-official` 記事を日別カレンダー表示。ACF `scarcity_score` 使用 |
| `single-custom-map.php` | 136 | 個別「目撃情報」記事（`Template Post Type: post`） | Googleマップ埋込＋X埋込。ACF `location_name` / `embedded_tweet` 使用 |

### 空ファイル（実質未使用）

`style.css` / `javascript.js` / `keyframes.css` / `amp.css` / `editor-style.css` / `trends.json`
はいずれも中身なし、またはCocoonデフォルトのまま。

---

## ⚠️ 重要な発見・注意点

1. **`functions.php` がデザインではなく「カテゴリ自動生成」で、しかも毎回実行**
   - `auto_create_all_categories()` が `add_action('init', ...)` で登録され、**全ページ表示のたびに**
     47都道府県＋店舗＋キャラ＋ニュースの全カテゴリを走査している。
   - `term_exists` チェックで二重作成は防いでいるが、毎リクエストの無駄な負荷。
   - カテゴリは既に全て作成済みなので、**この処理はもう外してよい**（サイトが時々重い / 503 を返す一因の可能性）。

2. **キービジュアル画像と商品カードが `front-page.php` にハードコード**
   - 画像URL（11〜12行目）とちいかわ商品カード（60〜75行目）が直書き。
   - 画像や商品を差し替えるには **PHPを直接編集**する必要がある。
   - 画像が `http://`（サイトは `https://`）で参照されており、mixed content 警告の可能性。

3. **トップの商品カードはポチップ（pochipp）ではなく手書きHTML**
   - 別途プラグイン「ポチップ」（`pchpp_custom_style`）も入っているが、トップの商品ボタンはそれとは別の手書きHTML。
     変更するにはこの手書きHTMLを直す。

4. **ACF（Advanced Custom Fields）依存**
   - `single-custom-map.php` / `page-calendar.php` は ACF のカスタムフィールド
     （`location_name` / `embedded_tweet` / `scarcity_score`）に依存。プラグインが必須。

---

## 目的別「どこを触るか」早見表

| やりたいこと | 触る場所 |
|---|---|
| トップの構造・並び・セクション | `front-page.php` |
| トップのキービジュアル画像 / 商品カード | `front-page.php`（ハードコード箇所） |
| トップのスライダー / カードの見た目 | `front-page.php` 内の `<style>`（320行目〜） |
| 色・余白などサイト全体 | カスタマイザーの追加CSS（外観 > カスタマイズ > 追加CSS） |
| カテゴリ一覧ページ | `category.php` |
| マップ / カレンダー固定ページ | `page-map.php` / `page-calendar.php` |
| 目撃情報の個別記事 | `single-custom-map.php` |

---

## 編集時の注意

- PHPは1文字の間違いでサイトが真っ白になる。**編集前に必ず対象ファイルをダウンロード（バックアップ）**する。
- 一番手軽な編集経路は **WordPress管理画面 > WP File Manager プラグイン**（ConoHa の FTP パスワード不要）。
- CSSの微調整だけならPHPを触らず**カスタマイザーの追加CSS**で完結できることが多い。

## 改善の提案（任意）

- `functions.php` の毎回カテゴリ生成を停止（見た目は不変・動作が軽くなる）。
- 各PHPに散った `<style>` を子テーマ `style.css` に集約すると保守しやすくなる。
- トップのキービジュアル/商品を頻繁に変えるなら、ハードコードをやめてカスタムフィールド化を検討。
