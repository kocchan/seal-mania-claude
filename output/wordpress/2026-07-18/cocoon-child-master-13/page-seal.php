<?php
/**
 * Template Name: シール情報ページ
 *
 * トップの「シール」を押した先のハブページ。
 * 固定ページ（例：タイトル「シール」/ slug: seal → /seal/）にこのテンプレートを割り当てて使う。
 * ヘッダー・フッター・メニューは Cocoon 側。本文のみ <div class="ktop"> で包む（CSSは style.css の .ktop）。
 */
get_header();

// --- 共通ヘルパー（front-page.php と同じ。function_exists で二重定義を防ぐ） ---
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
if ( ! function_exists( 'ktop_query' ) ) {
	function ktop_query( $slug = '', $count = 3 ) {
		$args = array( 'posts_per_page' => $count, 'ignore_sticky_posts' => true );
		if ( $slug ) { $args['category_name'] = $slug; }
		$q = new WP_Query( $args );
		if ( ! $q->have_posts() ) { $q = new WP_Query( array( 'posts_per_page' => $count, 'ignore_sticky_posts' => true ) ); }
		return $q;
	}
}
// カテゴリ名 slug からアーカイブURL（無ければ #）
if ( ! function_exists( 'ktop_cat_url' ) ) {
	function ktop_cat_url( $slug ) { $c = get_category_by_slug( $slug ); return $c ? get_category_link( $c->term_id ) : '#'; }
}
// タグ名からアーカイブURL（無ければ #）
if ( ! function_exists( 'ktop_tag_url' ) ) {
	function ktop_tag_url( $name ) { $t = get_term_by( 'name', $name, 'post_tag' ); return ( $t && ! is_wp_error( $t ) ) ? get_term_link( $t ) : '#'; }
}
?>

<style>
/* このページは .ktop 内に独自サイドバーを持つため、Cocoon標準のサイドバーを非表示にし本文を全幅にする（category.php と同じ対応） */
#sidebar { display: none !important; }
.page main#main { width: 100% !important; float: none !important; margin: 0 auto !important; }
</style>

<main id="main" class="main seal-page-main" role="main">
<div class="ktop">

	<div class="crumb"><a href="<?php echo esc_url( home_url( '/' ) ); ?>">ホーム</a><span>›</span>シール</div>

	<div class="pagehero">
		<div class="eye">SEAL ─ シールマニア</div>
		<h1>シール情報 <small>ボンボンドロップシール／うるちゅる／ぷっくりシール</small></h1>
	</div>

	<!-- 探し方タイル（6軸） -->
	<div class="findtiles">
		<a class="ftile" href="<?php echo esc_url( ktop_cat_url( 'new-item' ) ); ?>"><span class="ic">🆕</span><h3>新作・発売から</h3><p>今月の新作・発売カレンダー</p></a>
		<a class="ftile" href="<?php echo esc_url( ktop_cat_url( 'reservation' ) ); ?>"><span class="ic">🎟️</span><h3>抽選・予約から</h3><p>抽選販売・POPUP・再販</p></a>
		<a class="ftile" href="<?php echo esc_url( ktop_cat_url( 'prefecture' ) ); ?>"><span class="ic">📍</span><h3>エリアから</h3><p>47都道府県の目撃・在庫</p></a>
		<a class="ftile" href="<?php echo esc_url( ktop_cat_url( 'donki' ) ); ?>"><span class="ic">🏬</span><h3>お店から</h3><p>ドンキ・ロフト・ハンズ 他</p></a>
		<a class="ftile" href="#brand"><span class="ic">🧩</span><h3>ブランドから</h3><p>ボンドロ・うるちゅる・おしり</p></a>
		<a class="ftile" href="<?php echo esc_url( ktop_cat_url( 'guide' ) ); ?>"><span class="ic">🔰</span><h3>買い方ガイド</h3><p>相場・通販・シール帳のコツ</p></a>
	</div>

	<!-- 広告① -->
	<aside class="adcard">
		<span class="ad-label">PR</span>
		<div class="ad-thumb"><span class="k-ph"></span></div>
		<div class="ad-body">
			<p class="ad-name">正規品 ちいかわ シール モモンガ ボンボンドロップシール S8542929 サンスター文具</p>
			<div class="ad-price">¥2,980〜</div>
			<?php ktop_afi_buttons( 'ちいかわ ボンボンドロップシール' ); ?>
		</div>
	</aside>

	<div class="main-grid">
	<div>

		<!-- 話題の新作 -->
		<section class="sec">
			<div class="row-head"><h3>話題の<b>新作</b></h3><a class="more" href="<?php echo esc_url( ktop_cat_url( 'new-item' ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( 'new-item', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-new', '新作' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

		<!-- 広告② -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span></div>
			<div class="ad-body">
				<p class="ad-name">サンリオキャラクターズ ボンボンドロップ ミニチュアチャーム 全種セット</p>
				<div class="ad-price">¥3,480〜</div>
				<?php ktop_afi_buttons( 'サンリオ ボンボンドロップ ミニチュアチャーム' ); ?>
			</div>
		</aside>

		<!-- 抽選・予約まとめ -->
		<section class="sec">
			<div class="row-head"><h3>抽選・予約<b>まとめ</b></h3><a class="more" href="<?php echo esc_url( ktop_cat_url( 'reservation' ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( 'reservation', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-lot', '抽選' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

		<!-- ブランドから探す（純粋なシールブランドのみ） -->
		<section class="sec" id="brand">
			<div class="row-head"><h3>ブランド<b>から探す</b></h3></div>
			<div class="series">
				<a class="sitem" href="<?php echo esc_url( ktop_tag_url( 'ボンボンドロップシール' ) ); ?>"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#ffe1ec,var(--k-accent));"></span><span><b>ボンボンドロップシール</b><span class="c">2,030件</span></span></a>
				<a class="sitem" href="<?php echo esc_url( ktop_tag_url( 'うるちゅるポップシール' ) ); ?>"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#d9f4ff,var(--k-blue));"></span><span><b>うるちゅるPOP SEAL</b><span class="c">1,166件</span></span></a>
				<a class="sitem" href="<?php echo esc_url( ktop_tag_url( 'おしりシール' ) ); ?>"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#ffe8d1,var(--k-amber));"></span><span><b>おしりシール</b><span class="c">話題</span></span></a>
				<a class="sitem" href="#"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#efe0ff,var(--k-violet));"></span><span><b>その他ブランド</b><span class="c">一覧へ</span></span></a>
			</div>
			<p style="font-size:.76rem;color:var(--k-faint);margin:12px 2px 0;">※ ミニチュアチャームなどのチャーム系は <a href="#" style="color:var(--k-accent);font-weight:700;">めじるしアクセサリー</a> で扱います。</p>
		</section>

		<!-- 関連グッズ・収納 -->
		<section class="sec">
			<div class="row-head"><h3>関連グッズ・<b>収納</b></h3></div>
			<div class="series">
				<a class="sitem" href="#"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#d8f3e5,var(--k-green));"></span><span><b>シールメーカー</b><span class="c">作る・自作</span></span></a>
				<a class="sitem" href="#"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#d9f4ff,var(--k-blue));"></span><span><b>シールバインダー・ファイル</b><span class="c">収納</span></span></a>
				<a class="sitem" href="#"><span class="sb" style="background:radial-gradient(circle at 34% 30%,#ffe1ec,var(--k-accent));"></span><span><b>デコ・シール帳グッズ</b><span class="c">デコ</span></span></a>
			</div>
		</section>

		<!-- キャラから探す -->
		<section class="sec">
			<div class="row-head"><h3>キャラクター<b>から探す</b></h3></div>
			<div class="charchips">
				<a class="charchip" href="<?php echo esc_url( ktop_cat_url( 'sanrio' ) ); ?>">サンリオ</a>
				<a class="charchip" href="<?php echo esc_url( ktop_cat_url( 'chiikawa' ) ); ?>">ちいかわ</a>
				<a class="charchip" href="<?php echo esc_url( ktop_cat_url( 'shizukuchan' ) ); ?>">しずくちゃん</a>
				<a class="charchip" href="<?php echo esc_url( ktop_tag_url( '名探偵コナン うるちゅるPOP SEAL' ) ); ?>">名探偵コナン</a>
				<a class="charchip" href="<?php echo esc_url( ktop_tag_url( 'カラフルピーチ うるちゅるPOP SEAL' ) ); ?>">カラフルピーチ</a>
				<a class="charchip" href="<?php echo esc_url( ktop_cat_url( 'tamagotchi' ) ); ?>">たまごっち</a>
				<a class="charchip" href="<?php echo esc_url( ktop_cat_url( 'disney' ) ); ?>">ディズニー</a>
				<a class="charchip" href="#">すみっコぐらし</a>
				<a class="charchip" href="#">K-POP・アーティスト</a>
			</div>
		</section>

		<!-- 目撃・在庫 -->
		<section class="sec">
			<div class="row-head"><h3>エリアの<b>目撃・在庫情報</b></h3><a class="more" href="<?php echo esc_url( ktop_cat_url( 'prefecture' ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( '', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-spot', '目撃' ); endwhile; wp_reset_postdata(); ?>
			</div>
			<a class="btn-more" href="<?php echo esc_url( ktop_cat_url( 'prefecture' ) ); ?>">エリアの目撃情報をもっと見る</a>
		</section>

		<!-- 広告③ -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span></div>
			<div class="ad-body">
				<p class="ad-name">しずくちゃん うるちゅるシール mini／ぷっくりシール まとめ買い</p>
				<div class="ad-price">¥1,980〜</div>
				<?php ktop_afi_buttons( 'しずくちゃん うるちゅるシール' ); ?>
			</div>
		</aside>

		<!-- 買い方ガイド -->
		<section class="sec">
			<div class="row-head"><h3>買い方ガイド・<b>豆知識</b></h3><a class="more" href="<?php echo esc_url( ktop_cat_url( 'guide' ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( 'guide', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-shop', 'ガイド' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

	</div>

	<!-- サイドバー -->
	<aside class="side">
		<div class="widget">
			<div class="wtitle">シールを検索</div>
			<form class="w-search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
				<input type="text" name="s" placeholder="例：ちいかわ、抽選、大阪" value="<?php echo esc_attr( get_search_query() ); ?>">
				<button type="submit" aria-label="検索">🔍</button>
			</form>
		</div>

		<div class="widget">
			<div class="wtitle">シール人気ランキング</div>
			<ol class="rank">
				<?php
				$rank = new WP_Query( array( 'posts_per_page' => 5, 'meta_key' => 'views', 'orderby' => 'meta_value_num', 'order' => 'DESC', 'ignore_sticky_posts' => true ) );
				if ( ! $rank->have_posts() ) { $rank = new WP_Query( array( 'posts_per_page' => 5, 'ignore_sticky_posts' => true ) ); }
				$rn = 0;
				while ( $rank->have_posts() ) : $rank->the_post(); $rn++; ?>
					<li>
						<span class="rn"><?php echo (int) $rn; ?></span>
						<span class="rthumb"><?php if ( has_post_thumbnail() ) : the_post_thumbnail( 'thumbnail' ); else : ?><span class="k-ph"></span><?php endif; ?></span>
						<p><a href="<?php the_permalink(); ?>"><?php echo esc_html( get_the_title() ); ?></a></p>
					</li>
				<?php endwhile; wp_reset_postdata(); ?>
			</ol>
		</div>

		<div class="widget ad-widget">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span></div>
			<p class="ad-name">ボンボンドロップシール 人気キャラ まとめ買いセット</p>
			<div class="ad-price">¥2,480〜</div>
			<?php ktop_afi_buttons( 'ボンボンドロップシール', true ); ?>
		</div>

		<div class="widget">
			<div class="wtitle">ブランド一覧</div>
			<ul class="catlist">
				<li><a href="<?php echo esc_url( ktop_tag_url( 'ボンボンドロップシール' ) ); ?>">ボンボンドロップシール<span class="n">2,030</span></a></li>
				<li><a href="<?php echo esc_url( ktop_tag_url( 'うるちゅるポップシール' ) ); ?>">うるちゅるPOP SEAL<span class="n">1,166</span></a></li>
				<li><a href="<?php echo esc_url( ktop_tag_url( 'おしりシール' ) ); ?>">おしりシール<span class="n">話題</span></a></li>
				<li><a href="#">その他ブランド<span class="n">一覧</span></a></li>
			</ul>
		</div>

		<div class="widget">
			<div class="wtitle">カテゴリー</div>
			<ul class="catlist">
				<li><a href="<?php echo esc_url( ktop_cat_url( 'new-item' ) ); ?>">今月の新作<span class="n">60</span></a></li>
				<li><a href="<?php echo esc_url( ktop_cat_url( 'reservation' ) ); ?>">抽選・予約情報<span class="n">109</span></a></li>
				<li><a href="<?php echo esc_url( ktop_cat_url( 'prefecture' ) ); ?>">目撃・在庫情報<span class="n">4,518</span></a></li>
				<li><a href="<?php echo esc_url( ktop_cat_url( 'online' ) ); ?>">オンライン通販<span class="n">24</span></a></li>
				<li><a href="<?php echo esc_url( ktop_cat_url( 'guide' ) ); ?>">買い方ガイド<span class="n">ガイド</span></a></li>
			</ul>
		</div>
	</aside>

	</div><!-- /main-grid -->

</div><!-- /ktop -->
</main>

<?php get_footer(); ?>
