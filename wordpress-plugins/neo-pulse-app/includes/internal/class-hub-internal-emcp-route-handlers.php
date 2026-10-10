<?php
/**
 * POST /api/internal/emcp/invoke for Neo Agent Hub email desk (Phase 1 kwbllp).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Hub_Internal_Emcp_Route_Handlers {

	private const ALLOWED_TOOLS = array(
		'emcp-tools-search-content',
		'emcp-tools-get-post',
		'emcp-tools-list-posts',
		'emcp-tools-update-post',
		'emcp-tools-get-page-structure',
		'emcp-tools-update-element',
		'emcp-tools-rankmath-read',
		'emcp-tools-rankmath-write',
	);

	private const ALLOWED_SITES = array( 'kwbllp', 'blindmagic' );

	/**
	 * @param string              $subpath Route after internal/emcp/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		if ( strtoupper( $method ) !== 'POST' || $subpath !== 'invoke' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
			return;
		}

		if ( ! self::assert_hub_token() ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Unauthorized' ), 401 );
			return;
		}

		$site_key = isset( $body['siteKey'] ) ? trim( (string) $body['siteKey'] ) : '';
		$tool     = isset( $body['tool'] ) ? trim( (string) $body['tool'] ) : '';
		$args     = isset( $body['arguments'] ) && is_array( $body['arguments'] ) ? $body['arguments'] : array();

		if ( $site_key === '' || $tool === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'siteKey and tool are required' ), 400 );
			return;
		}
		if ( ! in_array( $site_key, self::ALLOWED_SITES, true ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Site not allowlisted for hub EMCP' ), 403 );
			return;
		}
		if ( ! in_array( $tool, self::ALLOWED_TOOLS, true ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Tool not allowlisted for hub EMCP' ), 403 );
			return;
		}

		$config = self::site_config( $site_key );
		if ( $config === null ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'error' => 'EMCP site credentials not configured on Pulse' ),
				503
			);
			return;
		}

		try {
			$resolved = Neo_Pulse_App_Hub_Internal_Emcp_Invoke_Normalizer::normalize(
				$tool,
				$args,
				function ( string $slug ) use ( $config ): int {
					return self::resolve_post_id_by_slug( $config, $slug );
				}
			);
			$data = Neo_Pulse_App_Emcp_Http_Client::call_tool(
				$config['url'],
				$config['authorization'],
				$resolved['tool'],
				$resolved['arguments']
			);
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'       => true,
					'data'     => $data,
					'warnings' => $resolved['warnings'],
				)
			);
		} catch ( Throwable $e ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'    => false,
					'error' => $e->getMessage(),
				),
				400
			);
		}
	}

	private static function assert_hub_token(): bool {
		$expected = self::env_first(
			array( 'NEO_PULSE_HUB_PULSE_SERVICE_TOKEN', 'NEO_PULSE_APP_HUB_PULSE_SERVICE_TOKEN' )
		);
		if ( $expected === '' ) {
			return false;
		}
		$header = isset( $_SERVER['HTTP_X_HUB_SERVICE_TOKEN'] ) ? (string) wp_unslash( $_SERVER['HTTP_X_HUB_SERVICE_TOKEN'] ) : '';
		if ( $header === '' ) {
			return false;
		}
		return hash_equals( $expected, $header );
	}

	/**
	 * @return array{url:string,authorization:string}|null
	 */
	private static function site_config( string $site_key ) {
		$json = self::env_first(
			array( 'NEO_PULSE_EMCP_HUB_SITES_JSON', 'NEO_PULSE_APP_EMCP_HUB_SITES_JSON' )
		);
		if ( $json === '' ) {
			return null;
		}
		$decoded = json_decode( $json, true );
		if ( ! is_array( $decoded ) || ! isset( $decoded[ $site_key ] ) || ! is_array( $decoded[ $site_key ] ) ) {
			return null;
		}
		$row = $decoded[ $site_key ];
		$url = isset( $row['url'] ) ? trim( (string) $row['url'] ) : '';
		$auth = isset( $row['authorization'] ) ? trim( (string) $row['authorization'] ) : '';
		if ( $url === '' || $auth === '' ) {
			return null;
		}
		return array(
			'url'           => $url,
			'authorization' => $auth,
		);
	}

	/**
	 * @param string[] $keys
	 */
	/**
	 * @param array{url:string,authorization:string} $config
	 */
	private static function resolve_post_id_by_slug( array $config, string $slug ): int {
		$slug = trim( $slug );
		if ( $slug === '' ) {
			return 0;
		}
		$data = Neo_Pulse_App_Emcp_Http_Client::call_tool(
			$config['url'],
			$config['authorization'],
			'emcp-tools-list-posts',
			array(
				'post_type' => 'post',
				'search'    => $slug,
				'per_page'  => 10,
			)
		);
		if ( ! is_array( $data ) ) {
			return 0;
		}
		$items = isset( $data['items'] ) && is_array( $data['items'] ) ? $data['items'] : ( isset( $data['posts'] ) && is_array( $data['posts'] ) ? $data['posts'] : array() );
		foreach ( $items as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$row_slug = isset( $row['slug'] ) ? trim( (string) $row['slug'] ) : '';
			$row_id   = isset( $row['post_id'] ) ? (int) $row['post_id'] : ( isset( $row['id'] ) ? (int) $row['id'] : 0 );
			if ( $row_id > 0 && $row_slug === $slug ) {
				return $row_id;
			}
		}
		if ( count( $items ) === 1 && is_array( $items[0] ) ) {
			$row    = $items[0];
			$row_id = isset( $row['post_id'] ) ? (int) $row['post_id'] : ( isset( $row['id'] ) ? (int) $row['id'] : 0 );
			if ( $row_id > 0 ) {
				return $row_id;
			}
		}
		return 0;
	}

	/**
	 * @param string[] $keys
	 */
	private static function env_first( array $keys ): string {
		foreach ( $keys as $key ) {
			if ( defined( $key ) ) {
				$val = constant( $key );
				if ( is_string( $val ) && trim( $val ) !== '' ) {
					return trim( $val );
				}
			}
			$from_env = getenv( $key );
			if ( is_string( $from_env ) && trim( $from_env ) !== '' ) {
				return trim( $from_env );
			}
		}
		return '';
	}
}
