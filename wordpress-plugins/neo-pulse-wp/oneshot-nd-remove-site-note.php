<?php
if ( ( $_GET['key'] ?? '' ) !== 'a8f3c2e1b9046d7e5f0a1c3b8d2e4f6' ) {
	http_response_code( 403 );
	exit( 'forbidden' );
}
header( 'Content-Type: application/json; charset=utf-8' );
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
	if ( is_readable( $dir . '/wp-load.php' ) ) {
		$wp_load = $dir . '/wp-load.php';
		break;
	}
	$dir = dirname( $dir );
}
if ( $wp_load === '' ) {
	http_response_code( 500 );
	echo '{"error":"wp-load missing"}';
	exit;
}
require_once $wp_load;
$file = WP_CONTENT_DIR . '/mu-plugins/nd-site-note.php';
$deleted = false;
if ( is_file( $file ) ) {
	$deleted = unlink( $file );
}
$flush = null;
if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush' ) ) {
	$flush = Neo_Pulse_Wp_Cache_Flush::flush_all();
}
echo wp_json_encode(
	array(
		'ok'      => $deleted,
		'path'    => $file,
		'existed' => ! $deleted && ! is_file( $file ),
		'flush'   => $flush,
	)
);
@unlink( __FILE__ );
