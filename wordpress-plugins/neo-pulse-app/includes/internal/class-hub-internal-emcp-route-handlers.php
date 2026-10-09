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
		'emcp-tools-update-post',
		'emcp-tools-get-page-structure',
		'emcp-tools-update-element',
	);

	private const ALLOWED_SITES = array( 'kwbllp' );

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
			$data = Neo_Pulse_App_Emcp_Http_Client::call_tool(
				$config['url'],
				$config['authorization'],
				$tool,
				$args
			);
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'   => true,
					'data' => $data,
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
