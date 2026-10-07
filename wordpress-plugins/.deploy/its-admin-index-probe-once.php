<?php
/**
 * One-time: load wp-admin/index.php as administrator with NEO Pulse WP active.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ITS_INDEX_PROBE_TOKEN' ) {
	http_response_code( 403 );
	header( 'Content-Type: text/plain; charset=utf-8' );
	exit( 'forbidden' );
}

ini_set( 'display_errors', '1' );
error_reporting( E_ALL );
register_shutdown_function(
	static function () {
		$e = error_get_last();
		if ( ! is_array( $e ) ) {
			return;
		}
		if ( ! in_array( (int) $e['type'], array( E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR ), true ) ) {
			return;
		}
		header( 'Content-Type: text/plain; charset=utf-8' );
		echo 'fatal ' . $e['message'] . ' @ ' . $e['file'] . ':' . $e['line'] . "\n";
	}
);

$dir     = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 6; $i++ ) {
	$candidate = $dir . '/wp-load.php';
	if ( is_readable( $candidate ) ) {
		$wp_load = $candidate;
		break;
	}
	$dir = dirname( $dir );
}
if ( $wp_load === '' ) {
	http_response_code( 500 );
	exit( 'wp-load missing' );
}

require_once $wp_load;

$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! isset( $admins[0] ) ) {
	exit( 'no admin' );
}

$uid                        = (int) $admins[0]->ID;
$expiration                 = time() + 600;
$scheme                     = is_ssl() ? 'secure_auth' : 'auth';
$auth_name                  = is_ssl() ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
$_COOKIE[ $auth_name ]       = wp_generate_auth_cookie( $uid, $expiration, $scheme );
$_COOKIE[ LOGGED_IN_COOKIE ] = wp_generate_auth_cookie( $uid, $expiration, 'logged_in' );
wp_set_current_user( $uid );

header( 'Content-Type: text/plain; charset=utf-8' );
echo 'neo_active=' . ( is_plugin_active( 'neo-pulse-wp/neo-pulse-wp.php' ) ? 'yes' : 'no' ) . "\n";
echo 'can_manage=' . ( current_user_can( 'manage_options' ) ? 'yes' : 'no' ) . "\n";

$_SERVER['REQUEST_URI'] = '/wp-admin/index.php';
$_SERVER['PHP_SELF']    = '/wp-admin/index.php';

ob_start();
require ABSPATH . 'wp-admin/index.php';
$html = ob_get_clean();

echo "index_ok\n";
echo 'html_len=' . (string) strlen( $html ) . "\n";
echo 'has_critical=' . ( str_contains( strtolower( $html ), 'critical error' ) ? 'yes' : 'no' ) . "\n";
echo 'has_dashboard=' . ( str_contains( $html, 'dashboard' ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
