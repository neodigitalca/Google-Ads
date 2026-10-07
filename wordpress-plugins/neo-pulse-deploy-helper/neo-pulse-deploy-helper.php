<?php
/**
 * Plugin Name: NEO Pulse Deploy Helper
 * Description: One-shot installer for NEO Pulse WP from a trusted zip URL. Removes itself after run.
 * Version: 1.0.0
 * Author: NEO Pulse
 */

defined( 'ABSPATH' ) || exit;

register_activation_hook(
	__FILE__,
	static function () {
		if ( ! current_user_can( 'install_plugins' ) ) {
			return;
		}

		$zip_url = 'https://neodigital.ca/wp-content/uploads/2026/10/neo-pulse-wp.zip';

		require_once ABSPATH . 'wp-admin/includes/file.php';
		require_once ABSPATH . 'wp-admin/includes/plugin.php';
		require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		require_once ABSPATH . 'wp-admin/includes/plugin-install.php';

		$tmp = download_url( $zip_url, 300 );
		if ( is_wp_error( $tmp ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ), true );
			wp_die( esc_html( $tmp->get_error_message() ) );
		}

		$skin     = new Automatic_Upgrader_Skin();
		$upgrader = new Plugin_Upgrader( $skin );
		$result   = $upgrader->install( $tmp );
		@unlink( $tmp );

		if ( is_wp_error( $result ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ), true );
			wp_die( esc_html( $result->get_error_message() ) );
		}

		$target = 'neo-pulse-wp/neo-pulse-wp.php';
		if ( ! file_exists( WP_PLUGIN_DIR . '/' . $target ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ), true );
			wp_die( 'NEO Pulse WP main file missing after install.' );
		}

		deactivate_plugins( plugin_basename( __FILE__ ), true );
		activate_plugin( $target, '', false, true );

		$helper = plugin_basename( __FILE__ );
		deactivate_plugins( $helper, true );
		delete_plugins( array( $helper ) );
	}
);
