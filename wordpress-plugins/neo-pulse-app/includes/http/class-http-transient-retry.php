<?php
/**
 * Retry wp_remote_* on transient transport failures (e.g. cURL 56 SSL EOF).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Http_Transient_Retry {

	public static function is_transient_transport_error( string $message ): bool {
		$m = strtolower( $message );
		return str_contains( $m, 'curl error 56' )
			|| str_contains( $m, 'curl error 52' )
			|| str_contains( $m, 'curl error 35' )
			|| str_contains( $m, 'unexpected eof' )
			|| str_contains( $m, 'ssl_read' )
			|| str_contains( $m, 'connection reset' )
			|| str_contains( $m, 'timed out' )
			|| str_contains( $m, 'timeout' )
			|| str_contains( $m, 'temporarily unavailable' )
			|| str_contains( $m, '502' )
			|| str_contains( $m, '503' )
			|| str_contains( $m, '504' );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>
	 */
	public static function with_defaults( array $args ): array {
		if ( ! isset( $args['httpversion'] ) ) {
			$args['httpversion'] = '1.1';
		}
		return $args;
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>|WP_Error
	 */
	public static function remote_get( string $url, array $args = array(), int $max_attempts = 3 ) {
		$args         = self::with_defaults( $args );
		$max_attempts = max( 1, $max_attempts );
		$last         = null;

		for ( $attempt = 1; $attempt <= $max_attempts; $attempt++ ) {
			if ( $attempt > 1 ) {
				sleep( min( 4, $attempt - 1 ) );
			}
			$response = wp_remote_get( $url, $args );
			if ( ! is_wp_error( $response ) ) {
				return $response;
			}
			$last = $response;
			if ( ! self::is_transient_transport_error( $response->get_error_message() ) ) {
				return $response;
			}
		}

		return $last ?? new WP_Error( 'neo-pulse_http', 'HTTP GET failed' );
	}

	/**
	 * @param array<string,mixed> $args
	 * @return array<string,mixed>|WP_Error
	 */
	public static function remote_post( string $url, array $args = array(), int $max_attempts = 3 ) {
		$args         = self::with_defaults( $args );
		$max_attempts = max( 1, $max_attempts );
		$last         = null;

		for ( $attempt = 1; $attempt <= $max_attempts; $attempt++ ) {
			if ( $attempt > 1 ) {
				sleep( min( 4, $attempt - 1 ) );
			}
			$response = wp_remote_post( $url, $args );
			if ( ! is_wp_error( $response ) ) {
				return $response;
			}
			$last = $response;
			if ( ! self::is_transient_transport_error( $response->get_error_message() ) ) {
				return $response;
			}
		}

		return $last ?? new WP_Error( 'neo-pulse_http', 'HTTP POST failed' );
	}
}
