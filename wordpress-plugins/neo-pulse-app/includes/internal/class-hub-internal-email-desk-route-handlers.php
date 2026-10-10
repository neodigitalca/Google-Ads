<?php
/**
 * GET /api/internal/email-desk/cloud-agent-contract
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Hub_Internal_Email_Desk_Route_Handlers {

	/**
	 * @param string              $subpath Route after internal/email-desk/.
	 * @param string              $method  HTTP method.
	 * @param array<string,mixed> $body    JSON body.
	 */
	public static function dispatch_http( string $subpath, string $method, array $body ): void {
		$subpath = trim( $subpath, '/' );
		if ( strtoupper( $method ) === 'GET' && $subpath === 'cloud-agent-contract' ) {
			Neo_Pulse_App_Api_Dispatcher::send_json( Neo_Pulse_App_Email_Desk_Cloud_Agent_Contract::payload() );
			return;
		}
		if ( strtoupper( $method ) === 'POST' && $subpath === 'meta-description-site-tasks' ) {
			$query = isset( $body['searchQuery'] ) ? trim( (string) $body['searchQuery'] ) : '';
			$post_id = isset( $body['postId'] ) ? (int) $body['postId'] : 0;
			$description = isset( $body['description'] ) ? trim( (string) $body['description'] ) : '';
			try {
				Neo_Pulse_App_Api_Dispatcher::send_json(
					array(
						'siteTasks' => Neo_Pulse_App_Email_Desk_Cloud_Agent_Contract::meta_description_site_tasks(
							$query,
							$post_id,
							$description
						),
					)
				);
			} catch ( InvalidArgumentException $e ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 400 );
			}
			return;
		}
		Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'Not found' ), 404 );
	}
}
