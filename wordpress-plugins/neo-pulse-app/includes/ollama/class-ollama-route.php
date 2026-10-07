<?php
/**
 * Proxy /api/ollama/* to configured Ollama base URL (legacy; OpenRouter is primary).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Ollama_Route {

	/**
	 * @param string              $subpath Path after ollama/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		if ( $subpath === 'models' && $method === 'GET' ) {
			self::models();
			return;
		}
		if ( $subpath === 'chat-completion' && $method === 'POST' ) {
			self::chat_completion( $body );
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'    => false,
				'error' => 'Not found',
				'path'  => 'ollama/' . $subpath,
			),
			404
		);
	}

	private static function base_url(): string {
		return class_exists( 'Neo_Pulse_App_Secrets_Loader' )
			? Neo_Pulse_App_Secrets_Loader::ollama_base_url()
			: '';
	}

	private static function request_headers(): array {
		$headers = array(
			'Accept'       => 'application/json',
			'Content-Type' => 'application/json',
		);
		$auth = class_exists( 'Neo_Pulse_App_Secrets_Loader' )
			? Neo_Pulse_App_Secrets_Loader::ollama_auth()
			: '';
		if ( $auth !== '' ) {
			$headers['Authorization'] = $auth;
		}
		return $headers;
	}

	public static function models(): void {
		$base = self::base_url();
		if ( $base === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => false,
					'success' => false,
					'error'   => 'Ollama base URL is not configured.',
					'models'  => array(),
				),
				503
			);
			return;
		}

		$response = wp_remote_get(
			$base . '/api/tags',
			array(
				'timeout' => 30,
				'headers' => self::request_headers(),
			)
		);

		if ( is_wp_error( $response ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'success' => false, 'error' => $response->get_error_message() ),
				502
			);
			return;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = (string) wp_remote_retrieve_body( $response );
		$json = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 || ! is_array( $json ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => false,
					'success' => false,
					'error'   => 'Ollama models request failed (' . $code . ')',
				),
				502
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			array(
				'ok'      => true,
				'success' => true,
				'models'  => $json['models'] ?? array(),
			),
			200
		);
	}

	/**
	 * @param array<string,mixed> $body Request JSON.
	 */
	public static function chat_completion( array $body ): void {
		$base = self::base_url();
		if ( $base === '' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => false,
					'success' => false,
					'error'   => 'Ollama base URL is not configured.',
				),
				503
			);
			return;
		}

		$payload = $body;
		unset( $payload['apiKey'], $payload['openRouterApiKey'] );

		$response = wp_remote_post(
			$base . '/api/chat',
			array(
				'timeout' => 300,
				'headers' => self::request_headers(),
				'body'    => wp_json_encode( $payload ),
			)
		);

		if ( is_wp_error( $response ) ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array( 'ok' => false, 'success' => false, 'error' => $response->get_error_message() ),
				502
			);
			return;
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = (string) wp_remote_retrieve_body( $response );
		$json = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			Neo_Pulse_App_Api_Dispatcher::send_json(
				array(
					'ok'      => false,
					'success' => false,
					'error'   => is_array( $json ) && isset( $json['error'] )
						? (string) $json['error']
						: 'Ollama chat request failed (' . $code . ')',
				),
				502
			);
			return;
		}

		Neo_Pulse_App_Api_Dispatcher::send_json(
			is_array( $json ) ? $json : array( 'ok' => true, 'raw' => $raw ),
			200
		);
	}
}
