<?php
/**
 * Minimal HTTP MCP client (EMCP Tools) for server-side invoke.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Emcp_Http_Client {

	/** @var array<string,string> */
	private static $sessions = array();

	/**
	 * @param string $mcp_url
	 * @param string $authorization Full Authorization header value (e.g. Basic …).
	 * @return mixed
	 */
	public static function call_tool( $mcp_url, $authorization, $tool_name, array $arguments ) {
		$key   = md5( $mcp_url . '|' . $authorization );
		$session = isset( self::$sessions[ $key ] ) ? self::$sessions[ $key ] : '';
		if ( $session === '' ) {
			$session = self::open_session( $mcp_url, $authorization );
			self::$sessions[ $key ] = $session;
		}

		$result = self::rpc(
			$mcp_url,
			$authorization,
			'tools/call',
			array(
				'name'      => $tool_name,
				'arguments' => $arguments,
			),
			2,
			$session
		);

		if ( isset( $result['session'] ) && $result['session'] !== '' ) {
			self::$sessions[ $key ] = (string) $result['session'];
		}

		if ( isset( $result['error'] ) ) {
			throw new RuntimeException( (string) $result['error'] );
		}

		return $result['data'];
	}

	/**
	 * @return string Mcp-Session-Id
	 */
	private static function open_session( $mcp_url, $authorization ) {
		$init = self::rpc(
			$mcp_url,
			$authorization,
			'initialize',
			array(
				'protocolVersion' => '2024-11-05',
				'capabilities'    => (object) array(),
				'clientInfo'      => array(
					'name'    => 'neo-pulse-email-desk',
					'version' => '1',
				),
			),
			1,
			''
		);
		if ( empty( $init['session'] ) ) {
			throw new RuntimeException( 'EMCP initialize did not return a session.' );
		}
		self::rpc(
			$mcp_url,
			$authorization,
			'notifications/initialized',
			(object) array(),
			null,
			$init['session']
		);
		return (string) $init['session'];
	}

	/**
	 * @param mixed $params
	 * @return array{session:string,data?:mixed,error?:string}
	 */
	private static function rpc( $mcp_url, $authorization, $method, $params, $id, $session ) {
		$headers = array(
			'Authorization' => $authorization,
			'Content-Type'  => 'application/json',
			'Accept'        => 'application/json, text/event-stream',
		);
		if ( $session !== '' ) {
			$headers['Mcp-Session-Id'] = $session;
		}

		$body = array(
			'jsonrpc' => '2.0',
			'method'  => $method,
			'params'  => $params,
		);
		if ( $id !== null ) {
			$body['id'] = $id;
		}

		$res = wp_remote_post(
			$mcp_url,
			array(
				'timeout' => 120,
				'headers' => $headers,
				'body'    => wp_json_encode( $body ),
			)
		);

		if ( is_wp_error( $res ) ) {
			return array(
				'session' => $session,
				'error'   => $res->get_error_message(),
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $res );
		$new_session = (string) wp_remote_retrieve_header( $res, 'mcp-session-id' );
		if ( $new_session === '' ) {
			$new_session = $session;
		}

		$raw = (string) wp_remote_retrieve_body( $res );
		$parsed = self::parse_rpc_body( $raw );
		if ( $code < 200 || $code >= 300 ) {
			return array(
				'session' => $new_session,
				'error'   => 'EMCP HTTP ' . $code,
			);
		}
		if ( is_array( $parsed ) && isset( $parsed['error'] ) ) {
			return array(
				'session' => $new_session,
				'error'   => wp_json_encode( $parsed['error'] ),
			);
		}

		return array(
			'session' => $new_session,
			'data'    => self::tool_payload( $parsed ),
		);
	}

	/**
	 * @param mixed $rpc
	 * @return mixed
	 */
	private static function tool_payload( $rpc ) {
		if ( ! is_array( $rpc ) ) {
			return $rpc;
		}
		$content = $rpc['result']['content'] ?? null;
		if ( ! is_array( $content ) ) {
			return $rpc['result'] ?? $rpc;
		}
		$texts = array();
		foreach ( $content as $part ) {
			if ( is_array( $part ) && ( $part['type'] ?? '' ) === 'text' && isset( $part['text'] ) ) {
				$texts[] = (string) $part['text'];
			}
		}
		if ( $texts === array() ) {
			return $rpc['result'] ?? $rpc;
		}
		$joined = implode( "\n", $texts );
		$decoded = json_decode( $joined, true );
		return $decoded !== null ? $decoded : array( 'text' => $joined );
	}

	/**
	 * @return mixed
	 */
	private static function parse_rpc_body( $text ) {
		$trim = trim( (string) $text );
		if ( $trim === '' ) {
			return null;
		}
		if ( $trim[0] === '{' ) {
			return json_decode( $trim, true );
		}
		$last = null;
		foreach ( preg_split( '/\r\n|\n/', $trim ) as $line ) {
			if ( ! str_starts_with( $line, 'data:' ) ) {
				continue;
			}
			$payload = trim( substr( $line, 5 ) );
			if ( $payload === '' || $payload === '[DONE]' ) {
				continue;
			}
			$last = json_decode( $payload, true );
		}
		return $last;
	}
}
