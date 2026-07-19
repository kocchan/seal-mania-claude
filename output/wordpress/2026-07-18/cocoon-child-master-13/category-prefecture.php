<?php
/**
 * 「都道府県別」カテゴリ（slug: prefecture → /prefecture/）専用テンプレート。
 * WordPressのテンプレート階層により、ファイルを置くだけでこのカテゴリにのみ自動適用される。
 * ※ 子カテゴリ（関東・東京など）は従来どおり category.php が使われる。
 *
 * 方針（2026-07-19）：目撃情報の記事化は毎週土曜更新の「週間まとめ」のみ。
 * このページは記事の垂れ流しではなく「県から探すハブ」として構成する。
 *  - 地方ブロック → 県チップ（週間まとめがある県は目立たせて直リンク）
 *  - 最新の週間まとめ一覧
 *  - 過去の目撃速報アーカイブ（ページ送り）
 */
get_header();

// --- 共通ヘルパー（front-page.php / page-seal.php と同じ。function_exists で二重定義を防ぐ） ---
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

// --- 地方ブロック → 県 のカテゴリツリーを取得 ---
$pref_root = get_category_by_slug( 'prefecture' );
$regions   = $pref_root ? get_categories( array( 'parent' => $pref_root->term_id, 'hide_empty' => false ) ) : array();

// 全県カテゴリを集め、週間まとめ記事（slug: sight-info-weekly-{県slug}）を1クエリでまとめて取得
$pref_cats = array();
foreach ( $regions as $region ) {
	foreach ( get_categories( array( 'parent' => $region->term_id, 'hide_empty' => false ) ) as $pc ) {
		$pref_cats[ $region->term_id ][] = $pc;
	}
}
$weekly_slugs = array();
foreach ( $pref_cats as $list ) {
	foreach ( $list as $pc ) { $weekly_slugs[] = 'sight-info-weekly-' . $pc->slug; }
}
$weekly_map   = array(); // 県slug => WP_Post
$weekly_posts = $weekly_slugs ? get_posts( array(
	'post_name__in'       => $weekly_slugs,
	'posts_per_page'      => 60,
	'post_type'           => 'post',
	'orderby'             => 'modified',
	'order'               => 'DESC',
	'ignore_sticky_posts' => true,
) ) : array();
foreach ( $weekly_posts as $wp_post_item ) {
	$weekly_map[ str_replace( 'sight-info-weekly-', '', $wp_post_item->post_name ) ] = $wp_post_item;
}
?>

<style>
/* Cocoon標準サイドバーを非表示にし本文を全幅化（category.php と同じ対応） */
#sidebar { display: none !important; }
.archive main#main { width: 100% !important; float: none !important; margin: 0 auto !important; }
</style>

<main id="main" class="main prefecture-page-main" role="main">
<div class="ktop">

	<div class="crumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">ホーム</a><span>›</span><a href="<?php echo esc_url( home_url( '/seal/' ) ); ?>">シール</a><span>›</span>エリアから探す</div>

	<div class="pagehero">
		<div class="eye">AREA ─ エリアから探す</div>
		<h1>都道府県別の目撃情報 <small>ボンボンドロップシールの目撃・在庫まとめ</small></h1>
	</div>

	<p class="pref-legend">目撃情報は毎週土曜に県ごとの「週間まとめ」へ更新中。📍付きの県は今週のまとめが読めるよ（タップで直行）。</p>

	<!-- ============ 地方ブロック → 県ボタン（地方ごとに色分け・中央寄せ） ============ -->
	<?php foreach ( $regions as $region ) :
		$prefs = isset( $pref_cats[ $region->term_id ] ) ? $pref_cats[ $region->term_id ] : array();
		if ( ! $prefs ) { continue; } ?>
		<div class="prefblock" data-region="<?php echo esc_attr( $region->slug ); ?>">
			<h3><?php echo esc_html( $region->name ); ?></h3>
			<div class="prefchips">
				<?php foreach ( $prefs as $pc ) :
					$has_weekly = isset( $weekly_map[ $pc->slug ] );
					$url        = $has_weekly ? get_permalink( $weekly_map[ $pc->slug ] ) : get_category_link( $pc->term_id );
					?>
					<a class="prefchip<?php echo $has_weekly ? ' has-weekly' : ''; ?>" href="<?php echo esc_url( $url ); ?>"><?php echo esc_html( $pc->name ); ?></a>
				<?php endforeach; ?>
			</div>
		</div>
	<?php endforeach; ?>

	<?php if ( $weekly_posts ) : ?>
	<!-- ============ 最新の週間まとめ ============ -->
	<section class="sec">
		<div class="row-head"><h3>🗾 最新の<b>週間目撃まとめ</b></h3></div>
		<p class="live-note">毎週土曜の朝に、その週の目撃情報を県ごとにまとめて更新しています。</p>
		<div class="cards">
			<?php foreach ( array_slice( $weekly_posts, 0, 9 ) as $wp_post_item ) : ?>
				<a class="card" href="<?php echo esc_url( get_permalink( $wp_post_item ) ); ?>">
					<div class="thumb">
						<span class="badge b-spot">週間</span>
						<?php if ( has_post_thumbnail( $wp_post_item ) ) : echo get_the_post_thumbnail( $wp_post_item, 'medium' ); else : ?><span class="k-ph"></span><?php endif; ?>
					</div>
					<div class="cbody">
						<h4><?php echo esc_html( get_the_title( $wp_post_item ) ); ?></h4>
						<time><?php echo esc_html( get_the_modified_date( 'Y.m.d', $wp_post_item ) ); ?> 更新</time>
					</div>
				</a>
			<?php endforeach; ?>
		</div>
	</section>
	<?php endif; ?>

	<!-- 広告 -->
	<aside class="adcard">
		<span class="ad-label">PR</span>
		<div class="ad-thumb"><span class="k-ph"></span><img src="https://item-shopping.c.yimg.jp/i/g/hobi-suto_set134-" alt="ボンボンドロップシール" loading="lazy" onerror="this.remove()"></div>
		<div class="ad-body">
			<p class="ad-name">近くのお店で見つからないときは通販もチェック ─ ボンボンドロップシール</p>
			<div class="ad-price">¥999〜</div>
			<?php if ( function_exists( 'ktop_afi_buttons' ) ) { ktop_afi_buttons( 'ボンボンドロップシール' ); } ?>
		</div>
	</aside>

	<!-- ============ 過去の目撃速報アーカイブ ============ -->
	<section class="sec">
		<div class="row-head"><h3>📚 過去の<b>目撃速報アーカイブ</b></h3></div>
		<?php if ( have_posts() ) : ?>
			<div class="cards">
				<?php while ( have_posts() ) : the_post(); ktop_render_card( 'b-spot', '目撃' ); endwhile; ?>
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
