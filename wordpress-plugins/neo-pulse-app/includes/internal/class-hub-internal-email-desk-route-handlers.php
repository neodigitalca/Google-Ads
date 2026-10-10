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
		if ( strtoupper( $method ) === 'POST' && $subpath === 'post-completion/parse-agent-message' ) {
			$text = isset( $body['text'] ) ? (string) $body['text'] : '';
			$parsed = Neo_Pulse_App_Email_Desk_Post_Completion::parse_agent_message( $text );
			if ( $parsed === null ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => 'No valid email-desk-completion block.' ), 400 );
				return;
			}
			Neo_Pulse_App_Api_Dispatcher::send_json( array( 'completion' => $parsed ) );
			return;
		}
		if ( strtoupper( $method ) === 'POST' && $subpath === 'post-completion/slack-reply-draft-card' ) {
			try {
				Neo_Pulse_App_Api_Dispatcher::send_json(
					Neo_Pulse_App_Email_Desk_Post_Completion::slack_reply_draft_ready( $body )
				);
			} catch ( InvalidArgumentException $e ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 400 );
			}
			return;
		}
		if ( strtoupper( $method ) === 'POST' && $subpath === 'post-completion/gmail-draft-url' ) {
			$draft_id = isset( $body['draftId'] ) ? trim( (string) $body['draftId'] ) : '';
			$user_index = isset( $body['userIndex'] ) ? (int) $body['userIndex'] : 0;
			try {
				Neo_Pulse_App_Api_Dispatcher::send_json(
					array(
						'gmailDraftUrl' => Neo_Pulse_App_Email_Desk_Post_Completion::gmail_draft_web_url( $draft_id, $user_index ),
					)
				);
			} catch ( InvalidArgumentException $e ) {
				Neo_Pulse_App_Api_Dispatcher::send_json( array( 'error' => $e->getMessage() ), 400 );
			}
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
