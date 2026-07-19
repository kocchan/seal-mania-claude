<?php
/**
 * 「抽選・予約情報」カテゴリ（slug: reservation → /news/reservation/）専用テンプレート。
 * WordPressのテンプレート階層により、ファイルを置くだけでこのカテゴリにのみ自動適用される。
 *
 * 特徴：
 *  - 記事タイトルの「【7/13締切】」等を解析し、受付中の抽選を締切が近い順に表示
 *  - 終了した抽選は通常のアーカイブとしてページ送り表示
 * ヘッダー・フッターは Cocoon 側。本文は <div class="ktop">（デザインは style.css）。
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

/**
 * タイトルから締切/販売日を解析して array( 'ts' => タイムスタンプ, 'kind' => '締切'|'販売' ) を返す。
 * 見つからなければ null。
 * 対応パターン：【7/13締切】【7/13締切21時】【8月上旬締切予定】【7/31販売】【7/17開催】【まもなく締切】
 * 年はタイトルに無いので投稿日から推定（半年以上ズレる場合は年をまたいだと判断）。
 */
if ( ! function_exists( 'ktop_parse_deadline' ) ) {
	function ktop_parse_deadline( $title, $post_ts ) {
		$mo = 0; $day = 0; $kind = '締切';
		if ( preg_match( '#(\d{1,2})\s*/\s*(\d{1,2})[^【】]*締切#u', $title, $m )
		  || preg_match( '#締切[^0-9【】]*(\d{1,2})\s*/\s*(\d{1,2})#u', $title, $m ) ) {
			$mo = (int) $m[1]; $day = (int) $m[2];
		} elseif ( preg_match( '#(\d{1,2})月(上旬|中旬|下旬)[^【】]*締切#u', $title, $m ) ) {
			$mo  = (int) $m[1];
			$day = ( '上旬' === $m[2] ) ? 10 : ( ( '中旬' === $m[2] ) ? 20 : 28 );
		} elseif ( preg_match( '#(\d{1,2})\s*/\s*(\d{1,2})[^【】]*(販売|開催|発売)#u', $title, $m ) ) {
			$mo = (int) $m[1]; $day = (int) $m[2]; $kind = '販売';
		} elseif ( false !== mb_strpos( $title, 'まもなく締切' ) ) {
			// 日付なしの「まもなく締切」は当日扱いで最上位に
			return array( 'ts' => (int) strtotime( 'today 23:59:59', current_time( 'timestamp' ) ), 'kind' => '締切' );
		} else {
			return null;
		}
		if ( $mo < 1 || $mo > 12 || $day < 1 || $day > 31 ) { return null; }
		// 年の推定：投稿月と半年以上離れていたら年またぎとみなす
		$py = (int) date( 'Y', $post_ts );
		$pm = (int) date( 'n', $post_ts );
		$y  = $py;
		if ( $mo < $pm - 6 ) { $y++; }
		if ( $mo > $pm + 6 ) { $y--; }
		return array( 'ts' => mktime( 23, 59, 59, $mo, $day, $y ), 'kind' => $kind );
	}
}
?>

<style>
/* Cocoon標準サイドバーを非表示にし本文を全幅化（category.php と同じ対応） */
#sidebar { display: none !important; }
.archive main#main { width: 100% !important; float: none !important; margin: 0 auto !important; }
</style>

<main id="main" class="main reservation-page-main" role="main">
<div class="ktop">

	<div class="crumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">ホーム</a><span>›</span><a href="<?php echo esc_url( home_url( '/seal/' ) ); ?>">シール</a><span>›</span>抽選・予約情報</div>

	<div class="pagehero">
		<div class="eye">LOTTERY ─ 抽選・予約</div>
		<h1>抽選・予約情報 <small>ボンボンドロップシールの抽選販売・POPUP・先行予約</small></h1>
	</div>

	<?php
	// ============ 受付中の抽選（1ページ目のみ・締切が近い順） ============
	if ( ! is_paged() ) :
		$scan = new WP_Query( array(
			'category_name'       => 'reservation',
			'posts_per_page'      => 60, // 直近60件からタイトルの締切を解析
			'ignore_sticky_posts' => true,
			'no_found_rows'       => true,
		) );
		$now    = current_time( 'timestamp' );
		$active = array();
		while ( $scan->have_posts() ) : $scan->the_post();
			$dl = ktop_parse_deadline( get_the_title(), get_post_time( 'U' ) );
			if ( null !== $dl && $dl['ts'] >= $now ) {
				$active[] = array( 'id' => get_the_ID(), 'dl' => $dl['ts'], 'kind' => $dl['kind'] );
			}
		endwhile;
		wp_reset_postdata();
		usort( $active, function ( $a, $b ) { return $a['dl'] <=> $b['dl']; } );
		$active = array_slice( $active, 0, 12 );

		if ( $active ) : ?>
		<section class="sec">
			<div class="row-head"><h3>🎯 受付中の<b>抽選・予約</b></h3></div>
			<p class="live-note">締切が近い順に表示しています。応募条件・店舗はかならず各記事で確認してね。</p>
			<div class="cards">
				<?php foreach ( $active as $item ) :
					$p        = get_post( $item['id'] );
					$days     = (int) floor( ( $item['dl'] - $now ) / DAY_IN_SECONDS );
					$dl_label = date_i18n( 'n/j', $item['dl'] ) . ' ' . $item['kind'];
					$chip     = 'dl-chip';
					if ( 0 === $days ) {
						$chip    .= ' today';
						$dl_label = ( '締切' === $item['kind'] ) ? '本日締切！' : '本日販売！';
					} elseif ( $days <= 3 ) {
						$chip    .= ' urgent';
						$dl_label = 'あと' . ( $days + 1 ) . '日・' . $dl_label;
					}
					?>
					<a class="card" href="<?php echo esc_url( get_permalink( $p ) ); ?>">
						<div class="thumb">
							<span class="badge b-lot">抽選</span>
							<?php if ( has_post_thumbnail( $p ) ) : echo get_the_post_thumbnail( $p, 'medium' ); else : ?><span class="k-ph"></span><?php endif; ?>
						</div>
						<div class="cbody">
							<span class="<?php echo esc_attr( $chip ); ?>"><?php echo esc_html( $dl_label ); ?></span>
							<h4><?php echo esc_html( get_the_title( $p ) ); ?></h4>
							<time><?php echo esc_html( get_the_date( 'Y.m.d', $p ) ); ?></time>
						</div>
					</a>
				<?php endforeach; ?>
			</div>
		</section>

		<!-- 広告 -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span><img src="https://item-shopping.c.yimg.jp/i/g/hobi-suto_set134-" alt="ちいかわ ボンボンドロップシール" loading="lazy" onerror="this.remove()"></div>
			<div class="ad-body">
				<p class="ad-name">抽選に外れても大丈夫。通販在庫をチェック ─ ちいかわ ボンボンドロップシール</p>
				<div class="ad-price">¥2,980〜</div>
				<?php if ( function_exists( 'ktop_afi_buttons' ) ) { ktop_afi_buttons( 'ちいかわ ボンボンドロップシール' ); } ?>
			</div>
		</aside>
		<?php endif; ?>
	<?php endif; ?>

	<!-- ============ すべての抽選・予約情報（通常アーカイブ） ============ -->
	<section class="sec">
		<div class="row-head"><h3>📚 すべての<b>抽選・予約情報</b></h3></div>
		<?php if ( have_posts() ) : ?>
			<div class="cards">
				<?php while ( have_posts() ) : the_post(); ktop_render_card( 'b-lot', '抽選' ); endwhile; ?>
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
