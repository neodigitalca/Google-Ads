<?php
/**
 * One-time: activate NEO Pulse WP (if needed) and load wp-admin/admin.php.
 */
if ( ( $_GET['key'] ?? '' ) !== 'ITS_NP_PROBE_TOKEN' ) {
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
require_once ABSPATH . 'wp-admin/includes/plugin.php';

header( 'Content-Type: text/plain; charset=utf-8' );

$plugin = 'neo-pulse-wp/neo-pulse-wp.php';
echo 'before_active=' . ( is_plugin_active( $plugin ) ? 'yes' : 'no' ) . "\n";

if ( ! is_plugin_active( $plugin ) && is_readable( WP_PLUGIN_DIR . '/neo-pulse-wp/neo-pulse-wp.php' ) ) {
	$result = activate_plugin( $plugin, '', false, true );
	if ( is_wp_error( $result ) ) {
		echo 'activate_error=' . $result->get_error_message() . "\n";
		exit;
	}
	echo "activated=yes\n";
}

echo 'after_active=' . ( is_plugin_active( $plugin ) ? 'yes' : 'no' ) . "\n";
echo 'neo_pulse_version=' . ( defined( 'NEO_PULSE_WP_VERSION' ) ? NEO_PULSE_WP_VERSION : 'undef' ) . "\n";

$admins = get_users(
	array(
		'role'   => 'administrator',
		'number' => 1,
	)
);
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

$_GET['page']           = 'neo-pulse-wp';
$_REQUEST['page']       = 'neo-pulse-wp';
$_SERVER['REQUEST_URI'] = '/wp-admin/admin.php?page=neo-pulse-wp';
$_SERVER['PHP_SELF']    = '/wp-admin/admin.php';

ob_start();
require ABSPATH . 'wp-admin/admin.php';
$html = ob_get_clean();

echo "admin_ok\n";
echo 'html_len=' . (string) strlen( $html ) . "\n";
echo 'has_critical=' . ( str_contains( $html, 'critical error' ) ? 'yes' : 'no' ) . "\n";

@unlink( __FILE__ );
