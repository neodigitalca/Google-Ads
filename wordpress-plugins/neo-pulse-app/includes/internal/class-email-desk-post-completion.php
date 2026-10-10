<?php
/**
 * Email desk post-completion (Gmail draft card + parse agent completion fence).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Email_Desk_Post_Completion {

	public const COMPLETION_FENCE = 'email-desk-completion';

	/**
	 * @return array<string,mixed>|null
	 */
	public static function parse_agent_message( string $text ): ?array {
		$text = trim( $text );
		if ( $text === '' ) {
			return null;
		}

		$pattern = '/```' . preg_quote( self::COMPLETION_FENCE, '/' ) . '\s*\n([\s\S]*?)\n```/i';
		if ( preg_match( $pattern, $text, $m ) ) {
			$decoded = self::decode_completion_json( trim( $m[1] ) );
			if ( $decoded !== null ) {
				return $decoded;
			}
		}

		if ( preg_match_all( '/```(?:json)?\s*\n([\s\S]*?)\n```/i', $text, $all, PREG_SET_ORDER ) ) {
			for ( $i = count( $all ) - 1; $i >= 0; $i-- ) {
				$decoded = self::decode_completion_json( trim( $all[ $i ][1] ) );
				if ( $decoded !== null ) {
					return $decoded;
				}
			}
		}

		return null;
	}

	/**
	 * @return array<string,mixed>|null
	 */
	private static function decode_completion_json( string $json ): ?array {
		$data = json_decode( $json, true );
		if ( ! is_array( $data ) ) {
			return null;
		}
		$status = isset( $data['status'] ) ? (string) $data['status'] : '';
		if ( $status !== 'ok' && $status !== 'failed' ) {
			return null;
		}
		$work_summary = isset( $data['workSummary'] ) ? trim( (string) $data['workSummary'] ) : '';
		$reply_draft  = isset( $data['replyDraft'] ) ? trim( (string) $data['replyDraft'] ) : '';
		if ( $status === 'ok' && $reply_draft === '' ) {
			return null;
		}
		return array(
			'status'       => $status,
			'workSummary'  => $work_summary,
			'replyDraft'   => $reply_draft,
		);
	}

	public static function gmail_draft_web_url( string $draft_id, int $user_index = 0 ): string {
		$draft_id = trim( $draft_id );
		if ( $draft_id === '' ) {
			throw new InvalidArgumentException( 'draftId is required.' );
		}
		return 'https://mail.google.com/mail/u/' . $user_index . '/#drafts?compose=' . rawurlencode( $draft_id );
	}

	/**
	 * @param array<string,mixed> $ctx
	 * @return array<string,mixed>
	 */
	public static function slack_reply_draft_ready( array $ctx ): array {
		$client   = isset( $ctx['clientName'] ) ? trim( (string) $ctx['clientName'] ) : 'Client';
		$subject  = isset( $ctx['emailSubject'] ) ? trim( (string) $ctx['emailSubject'] ) : 'Re: your request';
		$summary  = isset( $ctx['workSummary'] ) ? trim( (string) $ctx['workSummary'] ) : 'Site work finished.';
		$draft    = isset( $ctx['gmailDraftUrl'] ) ? trim( (string) $ctx['gmailDraftUrl'] ) : '';
		$thread   = isset( $ctx['gmailThreadUrl'] ) ? trim( (string) $ctx['gmailThreadUrl'] ) : '';
		$run_url  = isset( $ctx['cursorRunUrl'] ) ? trim( (string) $ctx['cursorRunUrl'] ) : '';

		if ( $draft === '' ) {
			throw new InvalidArgumentException( 'gmailDraftUrl is required.' );
		}

		$lines   = array(
			'*Proposed reply · ' . $subject . '*',
			$summary,
			'<' . $draft . '|Open reply draft in Gmail>',
		);
		if ( $thread !== '' ) {
			array_splice( $lines, 2, 0, array( '<' . $thread . '|Open thread in Gmail>' ) );
		}
		if ( $run_url !== '' ) {
			$lines[] = '<' . $run_url . '|Cursor cloud agent run>';
		}

		$elements = array(
			array(
				'type'      => 'button',
				'text'      => array(
					'type'  => 'plain_text',
					'text'  => 'Open reply draft',
					'emoji' => false,
				),
				'url'        => $draft,
				'action_id'  => 'email_desk_open_reply_draft',
			),
		);
		if ( $thread !== '' ) {
			$elements[] = array(
				'type'      => 'button',
				'text'      => array(
					'type'  => 'plain_text',
					'text'  => 'Open thread',
					'emoji' => false,
				),
				'url'        => $thread,
				'action_id'  => 'email_desk_open_gmail_thread',
			);
		}

		return array(
			'text'   => 'Email desk: reply draft ready for ' . $client,
			'blocks' => array(
				array(
					'type' => 'header',
					'text' => array(
						'type'  => 'plain_text',
						'text'  => 'Email desk · ' . $client,
						'emoji' => false,
					),
				),
				array(
					'type' => 'section',
					'text' => array(
						'type' => 'mrkdwn',
						'text' => implode( "\n", $lines ),
					),
				),
				array(
					'type'     => 'actions',
					'elements' => $elements,
				),
			),
		);
	}
}
