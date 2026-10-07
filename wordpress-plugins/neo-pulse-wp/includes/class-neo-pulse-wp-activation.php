<?php
/**
 * Activation and version migrations (deferred off the activate redirect).
 *
 * @package Neo_Pulse_Wp
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_Wp_Activation {

	const PENDING_OPTION = 'neo_pulse_wp_pending_activation';

	/**
	 * Queue install work; runs on next init so activate redirect does not fatal.
	 */
	public static function on_activate(): void {
		update_option( self::PENDING_OPTION, NEO_PULSE_WP_VERSION, false );
	}

	/**
	 * Run pending activation steps once WordPress is fully booted.
	 */
	public static function maybe_run_pending(): void {
		$pending = (string) get_option( self::PENDING_OPTION, '' );
		if ( $pending === '' || $pending !== NEO_PULSE_WP_VERSION ) {
			return;
		}

		delete_option( self::PENDING_OPTION );
		self::run_install_steps();
		update_option( 'neo_pulse_wp_installed_version', NEO_PULSE_WP_VERSION, false );
	}

	/**
	 * Version bump flush (same steps as activation, without re-queueing).
	 */
	public static function maybe_run_version_migration(): void {
		$installed = (string) get_option( 'neo_pulse_wp_installed_version', '' );
		if ( $installed === NEO_PULSE_WP_VERSION ) {
			return;
		}

		update_option( 'neo_pulse_wp_installed_version', NEO_PULSE_WP_VERSION, false );
		self::run_install_steps();
		self::purge_hosting_cache();
	}

	private static function run_install_steps(): void {
		if ( class_exists( 'Neo_Pulse_Wp_Llms_Txt', false ) ) {
			Neo_Pulse_Wp_Llms_Txt::register_rewrites();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Sitemap', false ) ) {
			Neo_Pulse_Wp_Sitemap::flush_rewrites();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Redirects', false ) ) {
			Neo_Pulse_Wp_Redirects::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Chat_Logs', false ) ) {
			Neo_Pulse_Wp_Chat_Logs::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Search_Logs', false ) ) {
			Neo_Pulse_Wp_Search_Logs::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Script_Manager', false ) ) {
			Neo_Pulse_Wp_Script_Manager::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Overseer', false ) ) {
			Neo_Pulse_Wp_Overseer::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Forms', false ) ) {
			Neo_Pulse_Wp_Forms::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Seo_Builder', false ) ) {
			Neo_Pulse_Wp_Seo_Builder::install();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Cache', false ) ) {
			Neo_Pulse_Wp_Speed_Cache::ensure_dirs();
		}
		if ( class_exists( 'Neo_Pulse_Wp_Speed_Settings', false ) ) {
			Neo_Pulse_Wp_Speed_Settings::seed_default_config_if_missing();
		}
	}

	private static function purge_hosting_cache(): void {
		if ( class_exists( 'Neo_Pulse_Wp_Cache_Flush', false ) ) {
			Neo_Pulse_Wp_Cache_Flush::flush_all();
		}
		if ( ! class_exists( 'WpeCommon', false ) ) {
			return;
		}
		if ( method_exists( 'WpeCommon', 'purge_memcached' ) ) {
			WpeCommon::purge_memcached();
		}
		if ( method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
			WpeCommon::purge_varnish_cache();
		}
	}
}
