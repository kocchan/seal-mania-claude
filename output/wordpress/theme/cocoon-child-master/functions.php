<?php //子テーマ用関数
if ( !defined( 'ABSPATH' ) ) exit;

//子テーマ用のビジュアルエディタースタイルを適用
add_editor_style();

//以下に子テーマ用の関数を書く


// カテゴリを一括自動作成する関数（階層対応版）
function auto_create_all_categories() {
    
    // カテゴリ構成の定義（配列で親・子・孫の階層を作ります）
    $category_tree = array(
        // 1. 都道府県別（親）
        array(
            'name' => '都道府県別', 'slug' => 'prefecture',
            'children' => array(
                array(
                    'name' => '北海道・東北', 'slug' => 'hokkaido-tohoku',
                    'children' => array(
                        array('name' => '北海道', 'slug' => 'hokkaido'),
                        array('name' => '青森', 'slug' => 'aomori'),
                        array('name' => '岩手', 'slug' => 'iwate'),
                        array('name' => '宮城', 'slug' => 'miyagi'),
                        array('name' => '秋田', 'slug' => 'akita'),
                        array('name' => '山形', 'slug' => 'yamagata'),
                        array('name' => '福島', 'slug' => 'fukushima'),
                    )
                ),
                array(
                    'name' => '関東', 'slug' => 'kanto',
                    'children' => array(
                        array('name' => '茨城', 'slug' => 'ibaraki'),
                        array('name' => '栃木', 'slug' => 'tochigi'),
                        array('name' => '群馬', 'slug' => 'gunma'),
                        array('name' => '埼玉', 'slug' => 'saitama'),
                        array('name' => '千葉', 'slug' => 'chiba'),
                        array('name' => '東京', 'slug' => 'tokyo'),
                        array('name' => '神奈川', 'slug' => 'kanagawa'),
                    )
                ),
                array(
                    'name' => '中部', 'slug' => 'chubu',
                    'children' => array(
                        array('name' => '新潟', 'slug' => 'niigata'),
                        array('name' => '富山', 'slug' => 'toyama'),
                        array('name' => '石川', 'slug' => 'ishikawa'),
                        array('name' => '福井', 'slug' => 'fukui'),
                        array('name' => '山梨', 'slug' => 'yamanashi'),
                        array('name' => '長野', 'slug' => 'nagano'),
                        array('name' => '岐阜', 'slug' => 'gifu'),
                        array('name' => '静岡', 'slug' => 'shizuoka'),
                        array('name' => '愛知', 'slug' => 'aichi'),
                    )
                ),
                array(
                    'name' => '近畿', 'slug' => 'kinki',
                    'children' => array(
                        array('name' => '三重', 'slug' => 'mie'),
                        array('name' => '滋賀', 'slug' => 'shiga'),
                        array('name' => '京都', 'slug' => 'kyoto'),
                        array('name' => '大阪', 'slug' => 'osaka'),
                        array('name' => '兵庫', 'slug' => 'hyogo'),
                        array('name' => '奈良', 'slug' => 'nara'),
                        array('name' => '和歌山', 'slug' => 'wakayama'),
                    )
                ),
                array(
                    'name' => '中国・四国', 'slug' => 'chugoku-shikoku',
                    'children' => array(
                        array('name' => '鳥取', 'slug' => 'tottori'),
                        array('name' => '島根', 'slug' => 'shimane'),
                        array('name' => '岡山', 'slug' => 'okayama'),
                        array('name' => '広島', 'slug' => 'hiroshima'),
                        array('name' => '山口', 'slug' => 'yamaguchi'),
                        array('name' => '徳島', 'slug' => 'tokushima'),
                        array('name' => '香川', 'slug' => 'kagawa'),
                        array('name' => '愛媛', 'slug' => 'ehime'),
                        array('name' => '高知', 'slug' => 'kochi'),
                    )
                ),
                array(
                    'name' => '九州・沖縄', 'slug' => 'kyushu-okinawa',
                    'children' => array(
                        array('name' => '福岡', 'slug' => 'fukuoka'),
                        array('name' => '佐賀', 'slug' => 'saga'),
                        array('name' => '長崎', 'slug' => 'nagasaki'),
                        array('name' => '熊本', 'slug' => 'kumamoto'),
                        array('name' => '大分', 'slug' => 'oita'),
                        array('name' => '宮崎', 'slug' => 'miyazaki'),
                        array('name' => '鹿児島', 'slug' => 'kagoshima'),
                        array('name' => '沖縄', 'slug' => 'okinawa'),
                    )
                ),
            )
        ),
        
        // 2. 入荷・抽選情報（親）
        array(
            'name' => '入荷・抽選情報', 'slug' => 'news',
            'children' => array(
                array('name' => '今月の新作', 'slug' => 'new-item'),
                array('name' => '抽選・予約情報', 'slug' => 'reservation'),
                array('name' => 'オンライン通販', 'slug' => 'online'),
            )
        ),

        // 3. 店舗攻略情報（親）
        array(
            'name' => '店舗攻略情報', 'slug' => 'store',
            'children' => array(
                array('name' => 'ドンキ', 'slug' => 'donki'),
                array('name' => 'LOFT', 'slug' => 'loft'),
                array('name' => 'ハンズ', 'slug' => 'hands'),
                array('name' => 'コンビニ', 'slug' => 'convini'),
                array('name' => 'ヴィレッジヴァンガード', 'slug' => 'village-vanguard'),
                array('name' => 'TSUTAYA', 'slug' => 'tsutaya'),
                array('name' => 'その他', 'slug' => 'other-store'),
            )
        ),

        // 4. キャラクターシール（親）
        array(
            'name' => 'キャラクターシール', 'slug' => 'character',
            'children' => array(
                array('name' => 'ディズニー', 'slug' => 'disney'),
                array('name' => 'サンリオ', 'slug' => 'sanrio'),
                array('name' => 'たまごっち', 'slug' => 'tamagotchi'),
                array('name' => 'しずくちゃん', 'slug' => 'shizukuchan'),
                array('name' => 'ちいかわ', 'slug' => 'chiikawa'),
                array('name' => 'その他', 'slug' => 'other-character'),
            )
        ),

        // 5. 一般ガイド（親・子なし）
        array('name' => '一般ガイド', 'slug' => 'guide'),
    );

    // ツリーを再帰的に（親から子へ順番に）作成するヘルパー関数
    if ( ! function_exists( 'insert_category_tree' ) ) {
        function insert_category_tree( $categories, $parent_id = 0 ) {
            foreach ( $categories as $cat ) {
                $term_id = 0;
                // 同じ階層に同じ名前のカテゴリがないかチェック
                $term_exists = term_exists( $cat['name'], 'category', $parent_id );

                if ( ! $term_exists ) {
                    $inserted = wp_insert_term(
                        $cat['name'],
                        'category',
                        array(
                            'slug'   => $cat['slug'],
                            'parent' => $parent_id,
                        )
                    );
                    if ( ! is_wp_error( $inserted ) ) {
                        $term_id = $inserted['term_id'];
                    }
                } else {
                    $term_id = is_array( $term_exists ) ? $term_exists['term_id'] : $term_exists;
                }

                // 子カテゴリ(children)が設定されている場合は、取得した親IDを使って自分自身を呼び出す
                if ( $term_id && ! empty( $cat['children'] ) ) {
                    insert_category_tree( $cat['children'], $term_id );
                }
            }
        }
    }

    // 実行
    insert_category_tree( $category_tree );
}

// サイトにアクセスしたタイミングで実行
// ⚠️ 2026-07-18 停止：カテゴリは全て作成済みのため、毎ページ表示ごとに全カテゴリを
//   走査する処理は不要（無駄な負荷）。カテゴリを作り直したい時だけ、下の行の
//   先頭の // を外して1回アクセス → すぐまた // を戻すこと。
// add_action( 'init', 'auto_create_all_categories' );


/************************************
** めじるしアクセサリー用カテゴリの一括作成（自己完結型・1回だけ実行）
**  2026-07-19 追加：第2の柱「めじるしアクセサリー」の記事パイプライン用。
**  実行済みフラグ(option)を見て未作成のときだけ動くので、
**  この functions.php をアップロードするだけでよい（コメント切替不要）。
************************************/
function ktop_create_mejirushi_categories() {
	if ( get_option( 'ktop_mejirushi_cats_created' ) ) { return; }

	// 親：めじるしアクセサリー
	$parent_id = 0;
	$exists    = term_exists( 'めじるしアクセサリー', 'category' );
	if ( $exists ) {
		$parent_id = is_array( $exists ) ? (int) $exists['term_id'] : (int) $exists;
	} else {
		$created = wp_insert_term( 'めじるしアクセサリー', 'category', array(
			'slug'        => 'mejirushi',
			'description' => '傘・バッグ・ボトルの目印チャーム「めじるしアクセサリー」の情報',
		) );
		if ( ! is_wp_error( $created ) ) { $parent_id = (int) $created['term_id']; }
	}

	// 子：新作・ガチャ情報
	if ( $parent_id && ! term_exists( '新作・ガチャ情報', 'category', $parent_id ) ) {
		wp_insert_term( '新作・ガチャ情報', 'category', array(
			'slug'   => 'mejirushi-new',
			'parent' => $parent_id,
		) );
	}

	if ( $parent_id ) { update_option( 'ktop_mejirushi_cats_created', 1 ); }
}
add_action( 'init', 'ktop_create_mejirushi_categories' );

/************************************
** アフィリエイト検索リンク（キーワードから生成）
**  ID は既存サイトの実アフィリエイトIDを流用：
**   - Amazon アソシエイト: sealmania-22
**   - 楽天アフィリエイト(afl): 50f17d50.13213066.50f17d51.fed7b043
**   - Yahoo!ショッピング: ValueCommerce MyLink（2026-07-22〜報酬化）
**     sid=3776298（サイトID） / pid=892663221（Yahoo!ショッピング自動提携プログラム）
************************************/
if ( ! function_exists( 'ktop_afi_amazon' ) ) {
	// キーワード → 実際のAmazon商品ページのASIN。
	// 登録済みのキーワードは検索結果ではなく商品ページへ直リンクする（2026-07-20〜）。
	// 未登録のキーワードは従来どおりキーワード検索にフォールバック。
	function ktop_afi_amazon( $kw ) {
		$asin_map = array(
			'サンリオ ボンボンドロップ ミニチュアチャーム' => 'B0GYGLNWTW', // サン'リオキャラクターズ ボンボン'ドロップ ミニチュアチャーム 全5種セット(フルコンプ)
			'ちいかわ ボンボンドロップシール'             => 'B0FN3ZW94L', // サンスター文具 ちいかわ グッズ ボンボンドロップシール モモンガ S8542929（広告カードの型番と完全一致）
			'しずくちゃん うるちゅるシール'               => 'B0DRHVTZPH', // サンスター文具 しずくちゃん シール 立体 ボンボンドロップシール B S8544930
		);
		if ( isset( $asin_map[ $kw ] ) ) {
			return 'https://www.amazon.co.jp/dp/' . $asin_map[ $kw ] . '/?tag=sealmania-22';
		}
		return 'https://www.amazon.co.jp/s?k=' . rawurlencode( $kw ) . '&tag=sealmania-22';
	}
}
if ( ! function_exists( 'ktop_afi_rakuten' ) ) {
	function ktop_afi_rakuten( $kw ) {
		return 'https://hb.afl.rakuten.co.jp/hgc/50f17d50.13213066.50f17d51.fed7b043/?pc='
			. rawurlencode( 'https://search.rakuten.co.jp/search/mall/' . $kw );
	}
}
if ( ! function_exists( 'ktop_afi_yahoo' ) ) {
	// ValueCommerce MyLink 経由でYahoo!ショッピング検索を計測リンク化する。
	// キーワードは通常どおり構築し、それをMyLinkのreferralサーブレットでラップするだけ
	// なので、どんなキーワードでも自動で報酬対象のリンクになる（Amazon/楽天と同じ設計）。
	function ktop_afi_yahoo( $kw ) {
		// vc_url は「元のURL全体（未エンコードの生の状態）」を1回だけエンコードして渡す。
		// ここで $kw を先にrawurlencodeしてしまうと二重エンコードになりVC側で正しく
		// 展開されないため、$target は生のキーワードを連結するだけにする。
		$target = 'https://shopping.yahoo.co.jp/search?p=' . $kw;
		return 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3776298&pid=892663221&vc_url=' . rawurlencode( $target );
	}
}
// 3ボタン（Amazon/楽天/Yahoo）をまとめて出力。$short=true で「楽天」表記（サイドバー用）
if ( ! function_exists( 'ktop_afi_buttons' ) ) {
	function ktop_afi_buttons( $kw, $short = false ) { ?>
		<div class="ad-btns">
			<a class="ad-btn amazon" href="<?php echo esc_url( ktop_afi_amazon( $kw ) ); ?>" rel="nofollow sponsored noopener" target="_blank">Amazon</a>
			<a class="ad-btn rakuten" href="<?php echo esc_url( ktop_afi_rakuten( $kw ) ); ?>" rel="nofollow sponsored noopener" target="_blank"><?php echo $short ? '楽天' : '楽天市場'; ?></a>
			<a class="ad-btn yahoo" href="<?php echo esc_url( ktop_afi_yahoo( $kw ) ); ?>" rel="nofollow sponsored noopener" target="_blank">Yahoo!</a>
		</div>
	<?php }
}