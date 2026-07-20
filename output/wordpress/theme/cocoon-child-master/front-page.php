<?php
/**
 * Template Name: フロントページ用テンプレート（キャラ推し活トップ）
 *
 * ヘッダー・フッター・グローバルメニューは Cocoon 側を利用。
 * 本文のみを <div class="ktop"> で包み、デザインは子テーマ style.css（.ktop 名前空間）で管理する。
 */
get_header();

/**
 * 記事カードを1枚出力するヘルパー。
 * ループ内（the_post 済み）で呼ぶこと。
 */
if ( ! function_exists( 'ktop_render_card' ) ) {
	function ktop_render_card( $badge_class, $badge_label ) { ?>
		<a class="card" href="<?php the_permalink(); ?>">
			<div class="thumb">
				<span class="badge <?php echo esc_attr( $badge_class ); ?>"><?php echo esc_html( $badge_label ); ?></span>
				<?php if ( has_post_thumbnail() ) : the_post_thumbnail( 'medium' ); else : ?>
					<span class="k-ph"></span>
				<?php endif; ?>
			</div>
			<div class="cbody">
				<h4><?php echo esc_html( get_the_title() ); ?></h4>
				<time><?php echo esc_html( get_the_date( 'Y.m.d' ) ); ?></time>
			</div>
		</a>
	<?php }
}

/**
 * カテゴリスラッグから最新記事を出す共通ループ。
 * $slug が空/該当なしのときは最新記事にフォールバック。
 */
if ( ! function_exists( 'ktop_query' ) ) {
	function ktop_query( $slug = '', $count = 3 ) {
		$args = array( 'posts_per_page' => $count, 'ignore_sticky_posts' => true );
		if ( $slug ) { $args['category_name'] = $slug; }
		$q = new WP_Query( $args );
		if ( ! $q->have_posts() ) { // フォールバック：最新記事
			$q = new WP_Query( array( 'posts_per_page' => $count, 'ignore_sticky_posts' => true ) );
		}
		return $q;
	}
}
// 「シール」ハブページ（page-seal.php を割り当てた固定ページ・slug: seal）へのリンク先
$seal_all_url = home_url( '/seal/' );
?>

<main id="main" class="main front-page-main" role="main">
<div class="ktop">

	<!-- ================= 注目記事カルーセル ================= -->
	<div class="krail">
		<?php
		$feat = new WP_Query( array( 'posts_per_page' => 6, 'meta_key' => 'views', 'orderby' => 'meta_value_num', 'order' => 'DESC', 'ignore_sticky_posts' => true ) );
		if ( ! $feat->have_posts() ) { $feat = new WP_Query( array( 'posts_per_page' => 6, 'ignore_sticky_posts' => true ) ); }
		while ( $feat->have_posts() ) : $feat->the_post(); ?>
			<a class="fcard" href="<?php the_permalink(); ?>">
				<div class="fthumb">
					<span class="catchip b-spot">注目</span>
					<?php if ( has_post_thumbnail() ) : the_post_thumbnail( 'medium' ); else : ?><span class="k-ph"></span><?php endif; ?>
				</div>
				<h4><?php echo esc_html( get_the_title() ); ?></h4>
			</a>
		<?php endwhile; wp_reset_postdata(); ?>
	</div>

	<!-- ================= ジャンルから探す ================= -->
	<section class="sec">
		<div class="shead"><h2>ジャンルから探す</h2></div>
		<div class="pillars">
			<a class="pill" href="<?php echo esc_url( $seal_all_url ); ?>">
				<span class="picon pi-pink">🩹</span>
				<div><h3>シール<span class="st on">運用中</span></h3><p>ボンボンドロップ等のシール情報。看板コンテンツ「シールマニア」へ →</p></div>
			</a>
			<?php $ktop_mejirushi_cat = get_category_by_slug( 'mejirushi' ); ?>
			<a class="pill" href="<?php echo esc_url( $ktop_mejirushi_cat ? get_category_link( $ktop_mejirushi_cat->term_id ) : '#mejirushi' ); ?>">
				<span class="picon pi-violet">🎀</span>
				<div><h3>めじるしアクセサリー<span class="st on">NEW</span></h3><p>傘・バッグ・ボトルの“目印チャーム”。サンリオ等のガチャ新作を毎日チェック →</p></div>
			</a>
			<a class="pill" href="#">
				<span class="picon pi-blue">🥚</span>
				<div><h3>ガチャ（カプセルトイ）<span class="st plan">構想中</span></h3><p>第5次ブームのガチャ活。新作＆設置場所を追跡予定</p></div>
			</a>
			<a class="pill" href="#">
				<span class="picon pi-amber">✉️</span>
				<div><h3>リクエスト募集<span class="st plan">＋</span></h3><p>扱ってほしいジャンルを教えてください</p></div>
			</a>
		</div>
	</section>

	<div class="main-grid">
	<div>

		<!-- ================= シール情報 ================= -->
		<div class="shead big" id="seal">
			<h2>シール情報</h2><span class="shead-sub">ボンボンドロップシール</span>
			<a class="more big-more" href="<?php echo esc_url( $seal_all_url ); ?>">シールをすべて見る ›</a>
		</div>

		<!-- 推しキャラから探す（→ /character/ キャラ別ハブ） -->
		<div class="charstrip">
			<?php
			$ktop_char_img_base = get_stylesheet_directory_uri() . '/images/char/';
			$ktop_char_links    = array( 'chiikawa' => 'ちいかわ', 'sanrio' => 'サンリオ', 'shizukuchan' => 'しずくちゃん', 'tamagotchi' => 'たまごっち', 'disney' => 'ディズニー' );
			foreach ( $ktop_char_links as $ktop_cslug => $ktop_cname ) :
				$ktop_ccat = get_category_by_slug( $ktop_cslug );
				if ( ! $ktop_ccat ) { continue; } ?>
				<a class="charchip-ic" href="<?php echo esc_url( get_category_link( $ktop_ccat->term_id ) ); ?>"><img src="<?php echo esc_url( $ktop_char_img_base . $ktop_cslug . '.png' ); ?>" alt="" loading="lazy"><?php echo esc_html( $ktop_cname ); ?></a>
			<?php endforeach;
			$ktop_char_hub = get_category_by_slug( 'character' );
			if ( $ktop_char_hub ) : ?>
				<a class="charchip-ic all" href="<?php echo esc_url( get_category_link( $ktop_char_hub->term_id ) ); ?>">推しキャラ別ページへ ›</a>
			<?php endif; ?>
		</div>

		<!-- 話題の新作 -->
		<section class="subsec">
			<div class="row-head"><h3>話題の<b>新作</b></h3><a class="more" href="<?php echo esc_url( get_category_link( get_category_by_slug( 'new-item' ) ? get_category_by_slug( 'new-item' )->term_id : 0 ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( 'new-item', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-new', '新作' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

		<!-- 広告① -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span><img src="https://item-shopping.c.yimg.jp/i/g/hobi-suto_set134-" alt="ちいかわ ボンボンドロップシール" loading="lazy" onerror="this.remove()"></div>
			<div class="ad-body">
				<p class="ad-name">正規品 ちいかわ シール モモンガ ボンボンドロップシール S8542929 サンスター文具</p>
				<div class="ad-price">¥2,980〜</div>
				<?php ktop_afi_buttons( 'ちいかわ ボンボンドロップシール' ); ?>
			</div>
		</aside>

		<!-- 抽選・予約まとめ -->
		<section class="subsec">
			<div class="row-head"><h3>抽選・予約<b>まとめ</b></h3><a class="more" href="<?php echo esc_url( get_category_link( get_category_by_slug( 'reservation' ) ? get_category_by_slug( 'reservation' )->term_id : 0 ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php $q = ktop_query( 'reservation', 3 ); while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-lot', '抽選' ); endwhile; wp_reset_postdata(); ?>
			</div>
		</section>

		<!-- エリアの目撃情報（最新） -->
		<section class="subsec">
			<div class="row-head"><h3>エリアの<b>目撃情報</b></h3><a class="more" href="<?php echo esc_url( get_category_link( get_category_by_slug( 'prefecture' ) ? get_category_by_slug( 'prefecture' )->term_id : 0 ) ); ?>">もっと見る ›</a></div>
			<div class="cards">
				<?php
			// 都道府県別カテゴリに限定＋更新日順（週間まとめは毎週上書き更新のため、更新日順で最新の週が先頭に来る）
			$q = new WP_Query( array( 'category_name' => 'prefecture', 'posts_per_page' => 3, 'orderby' => 'modified', 'ignore_sticky_posts' => true ) );
			while ( $q->have_posts() ) : $q->the_post(); ktop_render_card( 'b-spot', '目撃' ); endwhile; wp_reset_postdata(); ?>
			</div>
			<a class="btn-more" href="<?php echo esc_url( $seal_all_url ); ?>">シール情報をもっと見る</a>
		</section>

		<!-- 広告② -->
		<aside class="adcard">
			<span class="ad-label">PR</span>
			<div class="ad-thumb"><span class="k-ph"></span><img src="https://item-shopping.c.yimg.jp/i/g/primeworldjp_sanrio209" alt="サンリオ ボンボンドロップ ミニチュアチャーム" loading="lazy" onerror="this.remove()"></div>
			<div class="ad-body">
				<p class="ad-name">サンリオキャラクターズ ボンボンドロップ ミニチュアチャーム 全種セット</p>
				<div class="ad-price">¥3,480〜</div>
				<?php ktop_afi_buttons( 'サンリオ ボンボンドロップ ミニチュアチャーム' ); ?>
			</div>
		</aside>

		<!-- ================= めじるしアクセサリー ================= -->
		<?php
		// 実記事を取得（新作・ガチャ情報→無ければ親カテゴリ）。残り枠は準備中カードで埋める
		$mejirushi_cat = get_category_by_slug( 'mejirushi' );
		$mq = new WP_Query( array( 'category_name' => 'mejirushi-new', 'posts_per_page' => 3, 'ignore_sticky_posts' => true ) );
		if ( ! $mq->have_posts() ) { $mq = new WP_Query( array( 'category_name' => 'mejirushi', 'posts_per_page' => 3, 'ignore_sticky_posts' => true ) ); }
		$mejirushi_count = (int) $mq->post_count;
		?>
		<div class="shead big" id="mejirushi">
			<h2>めじるしアクセサリー</h2><span class="shead-sub">目印チャーム／めじるしチャーム</span><span class="st soon">NEW</span>
			<?php if ( $mejirushi_cat ) : ?><a class="more big-more" href="<?php echo esc_url( get_category_link( $mejirushi_cat->term_id ) ); ?>">めじるしをすべて見る ›</a><?php endif; ?>
		</div>
		<p class="block-note">いま話題の<b>めじるしアクセサリー（目印チャーム）</b>のコーナーができました！サンリオ等のガチャ新作・再販情報を毎日チェックしてお届けします。</p>

		<section class="subsec">
			<div class="row-head"><h3>話題の<b>新作</b></h3><?php $mejirushi_new_cat = get_category_by_slug( 'mejirushi-new' ); if ( $mejirushi_new_cat ) : ?><a class="more" href="<?php echo esc_url( get_category_link( $mejirushi_new_cat->term_id ) ); ?>">もっと見る ›</a><?php endif; ?></div>
			<div class="cards">
				<?php while ( $mq->have_posts() ) : $mq->the_post(); ktop_render_card( 'b-new', '新作' ); endwhile; wp_reset_postdata(); ?>
				<?php for ( $i = $mejirushi_count; $i < 3; $i++ ) : // 3枠に満たない分は準備中カード ?>
				<span class="card coming"><div class="thumb"><span class="badge b-prep">準備中</span><span class="k-ph"></span></div><div class="cbody"><h4>続々追加予定 ─ めじるしアクセサリーの新作情報</h4><time>Coming soon</time></div></span>
				<?php endfor; ?>
			</div>
		</section>

	</div>

	<!-- ================= サイドバー ================= -->
	<aside class="side">
		<div class="widget">
			<div class="wtitle">サイト内検索</div>
			<form class="w-search" method="get" action="<?php echo esc_url( home_url( '/' ) ); ?>">
				<input type="text" name="s" placeholder="例：ちいかわ、抽選、大阪" value="<?php echo esc_attr( get_search_query() ); ?>">
				<button type="submit" aria-label="検索">🔍</button>
			</form>
		</div>

		<div class="widget">
			<div class="wtitle">人気ランキング</div>
			<ol class="rank">
				<?php
				$rank = new WP_Query( array(
					'posts_per_page' => 5,
					'meta_key'       => 'views',
					'orderby'        => 'meta_value_num',
					'order'          => 'DESC',
					'ignore_sticky_posts' => true,
				) );
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
			<div class="ad-thumb"><span class="k-ph"></span><img src="https://item-shopping.c.yimg.jp/i/g/cast-shop_pe02139672" alt="サンリオ めじるしアクセサリー" loading="lazy" onerror="this.remove()"></div>
			<p class="ad-name">サンリオ めじるしアクセサリー ガチャ 全20種コンプセット</p>
			<div class="ad-price">¥3,000〜</div>
			<?php ktop_afi_buttons( 'めじるしアクセサリー サンリオ', true ); ?>
		</div>

		<div class="widget">
			<div class="wtitle">カテゴリー</div>
			<ul class="catlist">
				<li><a href="#seal">シール</a></li>
				<li><a href="<?php echo esc_url( get_category_link( get_category_by_slug( 'mejirushi' ) ? get_category_by_slug( 'mejirushi' )->term_id : 0 ) ); ?>">めじるしアクセサリー<span class="n">NEW</span></a></li>
				<li><a href="<?php echo esc_url( get_category_link( get_category_by_slug( 'reservation' ) ? get_category_by_slug( 'reservation' )->term_id : 0 ) ); ?>">抽選・予約情報</a></li>
				<li><a href="<?php echo esc_url( get_category_link( get_category_by_slug( 'new-item' ) ? get_category_by_slug( 'new-item' )->term_id : 0 ) ); ?>">今月の新作</a></li>
				<li><a href="<?php echo esc_url( get_category_link( get_category_by_slug( 'prefecture' ) ? get_category_by_slug( 'prefecture' )->term_id : 0 ) ); ?>">エリアから探す</a></li>
			</ul>
		</div>

		<div class="widget about">
			<div class="wtitle">このサイトについて</div>
			<div class="av">🩷</div>
			<div class="aname">キャラ推し活 編集部</div>
			<p>ぷにぷに♡かわいいグッズの「推し活」トレンド情報サイト。新作・抽選・再販・目撃を、JC〜若い女子に毎日お届け。</p>
		</div>
	</aside>

	</div><!-- /main-grid -->

</div><!-- /ktop -->
</main>

<?php get_footer(); ?>
