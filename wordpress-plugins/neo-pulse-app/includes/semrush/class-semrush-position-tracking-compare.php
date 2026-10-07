<?php
/**
 * Semrush Position Tracking: primary vs compare period keyword positions.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Semrush_Position_Tracking_Compare {

	const TRACKING_BASE = 'https://api.semrush.com/reports/v1/projects/';

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function run( array $body ): array {
		Neo_Pulse_App_Semrush_Client::bind_api_key_for_request( $body );
		try {
			return self::run_with_bound_key( $body );
		} finally {
			Neo_Pulse_App_Semrush_Client::clear_request_api_key();
		}
	}

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	private static function run_with_bound_key( array $body ): array {
		$campaign_raw = isset( $body['campaignId'] ) ? trim( (string) $body['campaignId'] ) : '';
		$project_id   = isset( $body['projectId'] ) ? trim( (string) $body['projectId'] ) : '';
		$primary_start = isset( $body['primaryStart'] ) ? trim( (string) $body['primaryStart'] ) : '';
		$primary_end   = isset( $body['primaryEnd'] ) ? trim( (string) $body['primaryEnd'] ) : '';
		$compare_start = isset( $body['compareStart'] ) ? trim( (string) $body['compareStart'] ) : '';
		$compare_end   = isset( $body['compareEnd'] ) ? trim( (string) $body['compareEnd'] ) : '';
		$tracked_url   = isset( $body['trackedUrl'] ) ? trim( (string) $body['trackedUrl'] ) : '';
		$period_only   = ! empty( $body['periodOnly'] );

		if ( $campaign_raw === '' ) {
			return array(
				'skipped' => true,
				'reason'  => 'missing_campaign_id',
				'rows'    => array(),
			);
		}

		if ( ! Neo_Pulse_App_Semrush_Client::has_api_key() ) {
			return array(
				'skipped' => true,
				'reason'  => 'no_api_key',
				'rows'    => array(),
			);
		}

		$campaign_path = self::resolve_effective_campaign_path( $project_id, $campaign_raw, $tracked_url );
		$url_mask      = self::tracked_url_mask( $tracked_url );

		$primary_map = self::fetch_positions_map(
			$campaign_path,
			$url_mask,
			$primary_start,
			$primary_end
		);
		if ( isset( $primary_map['skipped'] ) && $primary_map['skipped'] ) {
			return $primary_map;
		}

		$primary_positions = $primary_map['positions'] ?? array();
		if ( ! is_array( $primary_positions ) ) {
			$primary_positions = array();
		}

		if ( $period_only ) {
			$rows = array();
			foreach ( $primary_positions as $kw => $p ) {
				$rows[] = array(
					'keyword'         => (string) $kw,
					'primaryPosition' => $p,
					'comparePosition' => null,
					'change'          => null,
				);
			}
			return array(
				'skipped'        => false,
				'rows'           => $rows,
				'campaignPathId' => $campaign_path,
			);
		}

		$compare_map = self::fetch_positions_map(
			$campaign_path,
			$url_mask,
			$compare_start,
			$compare_end
		);
		if ( isset( $compare_map['skipped'] ) && $compare_map['skipped'] ) {
			return $compare_map;
		}

		$compare_positions = $compare_map['positions'] ?? array();
		if ( ! is_array( $compare_positions ) ) {
			$compare_positions = array();
		}

		$keywords = array_unique( array_merge( array_keys( $primary_positions ), array_keys( $compare_positions ) ) );
		sort( $keywords, SORT_STRING | SORT_FLAG_CASE );

		$rows = array();
		foreach ( $keywords as $kw ) {
			$p  = $primary_positions[ $kw ] ?? null;
			$c  = $compare_positions[ $kw ] ?? null;
			$delta = null;
			if ( is_numeric( $p ) && is_numeric( $c ) ) {
				$delta = (float) $c - (float) $p;
			}
			$rows[] = array(
				'keyword'          => $kw,
				'primaryPosition'  => $p,
				'comparePosition'  => $c,
				'change'           => $delta,
			);
		}

		return array(
			'skipped' => false,
			'rows'    => $rows,
			'campaignPathId' => $campaign_path,
		);
	}

	private static function resolve_effective_campaign_path( string $project_id, string $campaign_raw, string $tracked_url ): string {
		$project_id = trim( $project_id );
		if ( $project_id !== '' ) {
			$from_api = self::campaign_path_from_management_api( $project_id, $tracked_url );
			if ( $from_api !== '' ) {
				return $from_api;
			}
		}
		return self::resolve_campaign_path_id( $project_id, $campaign_raw );
	}

	/**
	 * @return string Campaign path id (project_campaign) from Semrush management API.
	 */
	private static function campaign_path_from_management_api( string $project_id, string $tracked_url ): string {
		$key = Neo_Pulse_App_Semrush_Client::api_key();
		if ( $key === '' ) {
			return '';
		}
		$auth = Neo_Pulse_App_Semrush_Client::auth_for_get( $key, array() );
		$url  = add_query_arg(
			$auth['params'],
			'https://api.semrush.com/management/v1/projects/' . rawurlencode( $project_id ) . '/tracking/campaigns/'
		);
		$response = Neo_Pulse_App_Http_Transient_Retry::remote_get(
			$url,
			array(
				'timeout' => 60,
				'headers' => $auth['headers'],
			),
			3
		);
		if ( is_wp_error( $response ) ) {
			return '';
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 || $raw === '' ) {
			return '';
		}
		$data = json_decode( $raw, true );
		if ( ! is_array( $data ) || empty( $data['campaigns'] ) || ! is_array( $data['campaigns'] ) ) {
			return '';
		}
		$site_host = Neo_Pulse_App_Semrush_Projects_Api::normalize_host( $tracked_url );
		$first     = '';
		foreach ( $data['campaigns'] as $row ) {
			if ( ! is_array( $row ) || empty( $row['id'] ) ) {
				continue;
			}
			$id = trim( (string) $row['id'] );
			if ( $id === '' ) {
				continue;
			}
			if ( $first === '' ) {
				$first = $id;
			}
			if ( $site_host === '' ) {
				continue;
			}
			$campaign_url = isset( $row['url'] ) ? Neo_Pulse_App_Semrush_Projects_Api::normalize_host( (string) $row['url'] ) : '';
			if ( $campaign_url !== '' && ( $campaign_url === $site_host || str_ends_with( $site_host, '.' . $campaign_url ) ) ) {
				return $id;
			}
		}
		return $first;
	}

	public static function resolve_campaign_path_id( string $project_id, string $campaign_id ): string {
		$campaign_id = trim( $campaign_id );
		if ( strpos( $campaign_id, '_' ) !== false ) {
			return $campaign_id;
		}
		$project_id = trim( $project_id );
		if ( $project_id !== '' && $campaign_id !== '' ) {
			return $project_id . '_' . $campaign_id;
		}
		return $campaign_id;
	}

	private static function tracked_url_mask( string $site_url ): string {
		$host = Neo_Pulse_App_Semrush_Projects_Api::normalize_host( $site_url );
		if ( $host === '' ) {
			return '';
		}
		return '*.' . $host . '/*';
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function fetch_positions_map(
		string $campaign_path,
		string $url_mask,
		string $start_ymd,
		string $end_ymd
	): array {
		$params = array(
			'action'         => 'report',
			'type'           => 'tracking_position_organic',
			'display_limit'  => 200,
			'linktype_filter' => 0,
		);
		if ( $url_mask !== '' ) {
			$params['url'] = $url_mask;
		}
		$begin = self::ymd_to_api_date( $start_ymd );
		$end   = self::ymd_to_api_date( $end_ymd );
		if ( $begin !== '' ) {
			$params['date_begin'] = $begin;
		}
		if ( $end !== '' ) {
			$params['date_end'] = $end;
		}

		$result = self::request_tracking_csv( $campaign_path, $params );
		if ( is_array( $result ) && ! empty( $result['skipped'] ) ) {
			return $result;
		}
		if ( ! is_string( $result ) || trim( $result ) === '' ) {
			return array(
				'skipped' => true,
				'reason'  => 'empty_response',
				'rows'    => array(),
			);
		}

		return array(
			'skipped'    => false,
			'positions'  => self::positions_from_tracking_body( $result, $url_mask ),
		);
	}

	/**
	 * @param array<string,string|int> $params
	 * @return string|array<string,mixed>
	 */
	private static function request_tracking_csv( string $campaign_path, array $params ) {
		$key = Neo_Pulse_App_Semrush_Client::api_key();
		if ( $key === '' ) {
			return array(
				'skipped' => true,
				'reason'  => 'no_api_key',
				'rows'    => array(),
			);
		}

		$auth = Neo_Pulse_App_Semrush_Client::auth_for_get( $key, $params );
		$url  = add_query_arg( $auth['params'], self::TRACKING_BASE . rawurlencode( $campaign_path ) . '/tracking/' );

		$response = Neo_Pulse_App_Http_Transient_Retry::remote_get(
			$url,
			array(
				'timeout' => 90,
				'headers' => $auth['headers'],
			),
			3
		);

		if ( is_wp_error( $response ) ) {
			return array(
				'skipped' => true,
				'reason'  => 'network',
				'message' => $response->get_error_message(),
				'rows'    => array(),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		if ( $code < 200 || $code >= 300 ) {
			return self::skip_from_api_body( $raw, $code );
		}

		if ( stripos( trim( $raw ), 'ERROR' ) === 0 ) {
			return self::skip_from_api_body( $raw, $code );
		}

		return (string) $raw;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function skip_from_api_body( string $raw, int $code ): array {
		$msg    = self::humanize_semrush_error_message( trim( $raw ), $code );
		$lo     = strtolower( $msg );
		$reason = 'api_error';
		if ( str_contains( $lo, 'api units' ) || str_contains( $lo, 'not enough' ) || str_contains( $lo, 'limit' ) ) {
			$reason = 'no_api_units';
		} elseif ( str_contains( $lo, 'wrong key' ) || str_contains( $lo, 'authorize' ) || str_contains( $lo, 'mcp personal access' ) ) {
			$reason = 'invalid_api_key';
		}
		return array(
			'skipped' => true,
			'reason'  => $reason,
			'message' => substr( $msg, 0, 400 ),
			'rows'    => array(),
		);
	}

	private static function humanize_semrush_error_message( string $raw, int $code ): string {
		if ( $raw === '' ) {
			return sprintf( 'HTTP %d', $code );
		}
		$decoded = json_decode( $raw, true );
		if ( is_array( $decoded ) && isset( $decoded['error'] ) && is_string( $decoded['error'] ) ) {
			$raw = trim( $decoded['error'] );
		}
		$lo = strtolower( $raw );
		if ( str_contains( $lo, 'authorize' ) || str_contains( $lo, 'wrong key' ) ) {
			$key = Neo_Pulse_App_Semrush_Client::api_key();
			if ( $key !== '' && Neo_Pulse_App_Semrush_Client::key_uses_apikey_header( $key ) ) {
				return 'Semrush Position Tracking does not accept MCP personal access tokens (semrtkn-pat). Paste your v3 API key from Semrush Profile, Subscription info, API units into Dashboard, API Keys, Semrush.';
			}
			return 'Semrush rejected the API key. Use your v3 API key from Semrush Profile, Subscription info, API units.';
		}
		return $raw;
	}

	private static function ymd_to_api_date( string $ymd ): string {
		$s = trim( $ymd );
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $s ) ) {
			return str_replace( '-', '', $s );
		}
		if ( preg_match( '/^\d{8}$/', $s ) ) {
			return $s;
		}
		return '';
	}

	/**
	 * Semrush returns CSV for legacy clients and JSON for current tracking reports.
	 *
	 * @return array<string,float> keyword => position
	 */
	private static function positions_from_tracking_body( string $body, string $url_mask ): array {
		$trim = ltrim( $body );
		if ( $trim !== '' && $trim[0] === '{' ) {
			return self::positions_from_tracking_json( $body, $url_mask );
		}
		return self::positions_from_tracking_csv( $body );
	}

	/**
	 * @return array<string,float> keyword => position (Fi column for the tracked URL mask).
	 */
	private static function positions_from_tracking_json( string $json, string $url_mask ): array {
		$decoded = json_decode( $json, true );
		if ( ! is_array( $decoded ) || empty( $decoded['data'] ) || ! is_array( $decoded['data'] ) ) {
			return array();
		}
		$out = array();
		foreach ( $decoded['data'] as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$kw = isset( $row['Ph'] ) ? trim( (string) $row['Ph'] ) : '';
			if ( $kw === '' ) {
				continue;
			}
			$fi = isset( $row['Fi'] ) && is_array( $row['Fi'] ) ? $row['Fi'] : array();
			$pos = self::numeric_position_from_url_map( $fi, $url_mask );
			if ( $pos === null ) {
				continue;
			}
			$out[ $kw ] = $pos;
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $map URL mask => position string
	 */
	private static function numeric_position_from_url_map( array $map, string $url_mask ): ?float {
		if ( $url_mask !== '' && array_key_exists( $url_mask, $map ) ) {
			return Neo_Pulse_App_Semrush_Table_Parse::num( $map[ $url_mask ] );
		}
		foreach ( $map as $value ) {
			$pos = Neo_Pulse_App_Semrush_Table_Parse::num( $value );
			if ( $pos !== null ) {
				return $pos;
			}
		}
		return null;
	}

	/**
	 * @return array<string,float> keyword => position
	 */
	private static function positions_from_tracking_csv( string $csv ): array {
		$rows = Neo_Pulse_App_Semrush_Table_Parse::rows_from_csv_text( $csv );
		$out  = array();
		foreach ( $rows as $row ) {
			$lower = Neo_Pulse_App_Semrush_Table_Parse::record_keys_lower( $row );
			$kw    = '';
			foreach ( array( 'ph', 'keyword', 'phrase', 'query' ) as $key ) {
				if ( ! empty( $lower[ $key ] ) ) {
					$kw = trim( (string) $lower[ $key ] );
					break;
				}
			}
			if ( $kw === '' ) {
				continue;
			}
			$pos = null;
			foreach ( array( 'position', 'po', 'avg. position', 'avg position', 'avgposition' ) as $key ) {
				if ( array_key_exists( $key, $lower ) ) {
					$pos = Neo_Pulse_App_Semrush_Table_Parse::num( $lower[ $key ] );
					if ( $pos !== null ) {
						break;
					}
				}
			}
			if ( $pos === null ) {
				continue;
			}
			$out[ $kw ] = $pos;
		}
		return $out;
	}
}
