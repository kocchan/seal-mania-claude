<?php
/**
 * 「キャラクターシール」カテゴリ（slug: character → /character/）専用テンプレート。
 * ファイルを置くだけでテンプレート階層により自動適用される。
 * ※ 子カテゴリ（ちいかわ・サンリオ等）は従来どおり category.php が使われる。
 *
 * 構成：キャラ選択タイル → 主要キャラの最新記事＋キャラ商品PR → ほかのキャラ → 全記事アーカイブ
 * 記事数・記事は「カテゴリ ∪ キャラ名タグ」から取得し、目撃速報タグを除外（12時間キャッシュ）。
 * アイコン画像：images/char/{slug}.png
 */
get_header();

// --- 共通ヘルパー（他テンプレートと同じ。function_exists で二重定義を防ぐ） ---
if ( ! function_exists( 'ktop_render_card' ) ) {
	function ktop_render_card( $badge_class, $badge_label ) { ?>
		<a class="card" href="<?php the_permalink(); ?>">
			<div class="thumb">
				<span class="badge <?php echo esc_attr( $badge_class ); ?>"><?php echo esc_html( $badge_label ); ?></span>
				<?php if ( has_post_thumbnail() ) : the_post_thumbnail( 'medium' ); else : ?><span class="k-ph"></span><?php endif; ?>
			</div>
			<div class="cbody">
				<h4><?php echo esc_html( get_the_title() ); ?></h4>
				<time><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></time>
			</div>
		</a>
	<?php }
}

// 記事の内容からバッジを決める（抽選/新作/週間/シール）
if ( ! function_exists( 'ktop_char_badge' ) ) {
	function ktop_char_badge( $post_id ) {
		if ( has_category( 'reservation', $post_id ) ) { return array( 'b-lot', '抽選' ); }
		if ( has_category( 'new-item', $post_id ) )    { return array( 'b-new', '新作' ); }
		if ( has_tag( '週間まとめ', $post_id ) )        { return array( 'b-spot', '週間' ); }
		return array( 'b-shop', 'シール' );
	}
}

// --- キャラ定義（表示順） ---
$ktop_chars = array(
	'chiikawa'    => array( 'name' => 'ちいかわ',   'class' => 'ct-chiikawa',   'desc' => 'ボンドロ・うるちゅるで大人気。抽選・目撃も最多！' ),
	'sanrio'      => array( 'name' => 'サンリオ',   'class' => 'ct-sanrio',     'desc' => 'クロミ・シナモン・キティ。ミニチュアチャームも◎' ),
	'shizukuchan' => array( 'name' => 'しずくちゃん', 'class' => 'ct-shizuku',   'desc' => 'うるちゅるシールの本命。新作ラッシュ中' ),
	'tamagotchi'  => array( 'name' => 'たまごっち',  'class' => 'ct-tamagotchi', 'desc' => '復刻ブームでシールも再注目' ),
	'disney'      => array( 'name' => 'ディズニー',  'class' => 'ct-disney',     'desc' => 'プリンセス＆ツイステのぷくぷくシール' ),
);

// --- 目撃速報タグID ---
$sight_tag    = get_term_by( 'name', '目撃速報', 'post_tag' );
$sight_tag_id = $sight_tag ? (int) $sight_tag->term_id : 0;

/**
 * キャラの記事を取得する WP_Query 引数。
 * 「キャラのカテゴリ ∪ キャラ名を含むタグ」かつ「目撃速報タグを除く」。
 */
if ( ! function_exists( 'ktop_char_query_args' ) ) {
	function ktop_char_query_args( $cat_slug, $char_name, $sight_tag_id, $count ) {
		$tag_ids = get_terms( array(
			'taxonomy'   => 'post_tag',
			'search'     => $char_name,
			'fields'     => 'ids',
			'hide_empty' => true,
			'number'     => 30,
		) );
		if ( is_wp_error( $tag_ids ) ) { $tag_ids = array(); }
		$or_group = array( 'relation' => 'OR', array( 'taxonomy' => 'category', 'field' => 'slug', 'terms' => $cat_slug ) );
		if ( $tag_ids ) { $or_group[] = array( 'taxonomy' => 'post_tag', 'field' => 'term_id', 'terms' => $tag_ids ); }
		$tax_query = array( 'relation' => 'AND', $or_group );
		if ( $sight_tag_id ) {
			$tax_query[] = array( 'taxonomy' => 'post_tag', 'field' => 'term_id', 'terms' => array( $sight_tag_id ), 'operator' => 'NOT IN' );
		}
		return array(
			'posts_per_page'      => $count,
			'ignore_sticky_posts' => true,
			'tax_query'           => $tax_query,
		);
	}
}

// --- 記事数（目撃除く）を12時間キャッシュで取得 ---
$char_counts = get_transient( 'ktop_char_counts' );
if ( ! is_array( $char_counts ) ) {
	$char_counts = array();
	foreach ( $ktop_chars as $slug => $c ) {
		$q = new WP_Query( array_merge( ktop_char_query_args( $slug, $c['name'], $sight_tag_id, 1 ), array( 'fields' => 'ids', 'no_found_rows' => false ) ) );
		$char_counts[ $slug ] = (int) $q->found_posts;
	}
	// その他 ＝ キャラクターシール親カテゴリ直付きのみ（子カテゴリ・目撃除く）
	$char_cat = get_category_by_slug( 'character' );
	$args     = array( 'posts_per_page' => 1, 'fields' => 'ids', 'ignore_sticky_posts' => true, 'category__in' => array( $char_cat ? $char_cat->term_id : 0 ) );
	if ( $sight_tag_id ) { $args['tag__not_in'] = array( $sight_tag_id ); }
	$q = new WP_Query( $args );
	$char_counts['other'] = (int) $q->found_posts;
	set_transient( 'ktop_char_counts', $char_counts, 12 * HOUR_IN_SECONDS );
}

$char_img_base = get_stylesheet_directory_uri() . '/images/char/';
?>

<style>
/* Cocoon標準サイドバーを非表示にし本文を全幅化（category.php と同じ対応） */
#sidebar { display: none !important; }
.archive main#main { width: 100% !important; float: none !important; margin: 0 auto !important; }
</style>

<main id="main" class="main character-page-main" role="main">
<div class="ktop">

	<div class="crumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">ホーム</a><span>›</span><a href="<?php echo esc_url( home_url( '/seal/' ) ); ?>">シール</a><span>›</span>キャラから探す</div>

	<div class="pagehero">
		<div class="eye">CHARACTER ─ キャラから探す</div>
		<h1>推しキャラで探す <small>ちいかわ・サンリオ・しずくちゃん…推しのシール情報を一気にチェック</small></h1>
	</div>

	<?php if ( ! is_paged() ) : // ハブ部分は1ページ目のみ表示 ?>
	<p class="pref-legend">推しのキャラを選んでね。（　）内は記事数だよ（目撃速報はのぞく）。</p>

	<!-- ============ キャラ選択タイル ============ -->
	<div class="chargrid">
		<?php foreach ( $ktop_chars as $slug => $c ) :
			$cat = get_category_by_slug( $slug );
			if ( ! $cat ) { continue; } ?>
			<a class="chartile <?php echo esc_attr( $c['class'] ); ?>" href="<?php echo esc_url( get_category_link( $cat->term_id ) ); ?>">
				<span class="av"><img src="<?php echo esc_url( $char_img_base . $slug . '.png' ); ?>" alt="<?php echo esc_attr( $c['name'] ); ?>" loading="lazy"></span>
				<h3><?php echo esc_html( $c['name'] ); ?></h3>
				<span class="cnt">（<?php echo (int) ( isset( $char_counts[ $slug ] ) ? $char_counts[ $slug ] : 0 ); ?>）</span>
				<p><?php echo esc_html( $c['desc'] ); ?></p>
			</a>
		<?php endforeach; ?>
		<a class="chartile ct-other" href="#char-all">
			<span class="av">✨</span>
			<h3>その他キャラ</h3>
			<span class="cnt">（<?php echo (int) ( isset( $char_counts['other'] ) ? $char_counts['other'] : 0 ); ?>）</span>
			<p>ナガノキャラ・ちょこみん・すみっコ・mofusandなど</p>
		</a>
	</div>

	<?php
	// ============ 主要キャラの最新記事＋PR ============
	$featured = array(
		'chiikawa'    => array( 'ad_name' => '正規品 ちいかわ ボンボンドロップシール（モモンガ・ハチワレ）サンスター文具', 'ad_price' => '¥2,980〜', 'ad_kw' => 'ちいかわ ボンボンドロップシール', 'ad_img' => 'https://item-shopping.c.yimg.jp/i/g/hobi-suto_set134-' ),
		'sanrio'      => array( 'ad_name' => 'サンリオキャラクターズ ボンボンドロップ ミニチュアチャーム 全種セット', 'ad_price' => '¥3,480〜', 'ad_kw' => 'サンリオ ボンボンドロップ ミニチュアチャーム', 'ad_img' => 'https://item-shopping.c.yimg.jp/i/g/primeworldjp_sanrio209' ),
		'shizukuchan' => array( 'ad_name' => 'しずくちゃん うるちゅるシール mini／ぷっくりシール まとめ買い', 'ad_price' => '¥1,980〜', 'ad_kw' => 'しずくちゃん うるちゅるシール', 'ad_img' => 'https://item-shopping.c.yimg.jp/i/g/bii-dama_52994972' ),
	);
	foreach ( $featured as $slug => $ad ) :
		$c   = $ktop_chars[ $slug ];
		$cat = get_category_by_slug( $slug );
		$q   = new WP_Query( ktop_char_query_args( $slug, $c['name'], $sight_tag_id, 3 ) );
		if ( ! $q->have_posts() ) { wp_reset_postdata(); continue; } ?>
		<section class="sec">
			<div class="row-head">
				<h3><span class="chip-av"><img src="<?php echo esc_url( $char_img_base . $slug . '.png' ); ?>" alt="" loading="lazy"></span><?php echo esc_html( $c['name'] ); ?>の<b>最新記事</b></h3>
				<?php if ( $cat ) : ?><a class="more" href="<?php echo esc_url( get_category_link( $cat->term_id ) ); ?>">もっと見る ›</a><?php endif; ?>
			</div>
			<div class="cards">
				<?php while ( $q->have_posts() ) : $q->the_post();
					list( $bc, $bl ) = ktop_char_badge( get_the_ID() );
					ktop_render_card( $bc, $bl );
				endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

		<!-- 広告：<?php echo esc_html( $c['name'] ); ?> -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span><img src="<?php echo esc_url( $ad['ad_img'] ); ?>" alt="<?php echo esc_attr( $ad['ad_kw'] ); ?>" loading="lazy" onerror="this.remove()"></div>
			<div class="ad-body">
				<p class="ad-name"><?php echo esc_html( $ad['ad_name'] ); ?></p>
				<div class="ad-price"><?php echo esc_html( $ad['ad_price'] ); ?></div>
				<?php if ( function_exists( 'ktop_afi_buttons' ) ) { ktop_afi_buttons( $ad['ad_kw'] ); } ?>
			</div>
		</aside>
	<?php endforeach; ?>

	<!-- ============ ほかのキャラ ============ -->
	<section class="sec">
		<div class="row-head"><h3>🌈 ほかの<b>キャラも見る</b></h3></div>
		<div class="charbtns">
			<?php foreach ( array( 'tamagotchi', 'disney' ) as $slug ) :
				$c   = $ktop_chars[ $slug ];
				$cat = get_category_by_slug( $slug );
				if ( ! $cat ) { continue; } ?>
				<a class="charbtn <?php echo esc_attr( $c['class'] ); ?>" href="<?php echo esc_url( get_category_link( $cat->term_id ) ); ?>"><?php echo esc_html( $c['name'] ); ?><span class="n">（<?php echo (int) ( isset( $char_counts[ $slug ] ) ? $char_counts[ $slug ] : 0 ); ?>）</span></a>
			<?php endforeach; ?>
			<a class="charbtn ct-other" href="#char-all">その他キャラ<span class="n">（<?php echo (int) ( isset( $char_counts['other'] ) ? $char_counts['other'] : 0 ); ?>）</span></a>
		</div>
	</section>
	<?php endif; // is_paged ?>

	<!-- ============ 全記事アーカイブ ============ -->
	<section class="sec" id="char-all">
		<div class="row-head"><h3>📚 キャラクターシールの<b>記事一覧</b></h3></div>
		<?php if ( have_posts() ) : ?>
			<div class="cards">
				<?php while ( have_posts() ) : the_post();
					list( $bc, $bl ) = ktop_char_badge( get_the_ID() );
					ktop_render_card( $bc, $bl );
				endwhile; ?>
			</div>
			<div class="pagi">
				<?php the_posts_pagination( array( 'mid_size' => 2, 'prev_text' => '前へ', 'next_text' => '次へ' ) ); ?>
			</div>
		<?php else : ?>
			<p class="live-note">記事準備中です＞＜ 更新までお待ちください。</p>
		<?php endif; ?>
	</section>

</div>
</main>

<?php get_footer(); ?>
