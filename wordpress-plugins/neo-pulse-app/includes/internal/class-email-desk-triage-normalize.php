<?php
/**
 * Normalize OpenRouter email-desk triage JSON (replyDraft sentinel).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Email_Desk_Triage_Normalize {

	public const DEFERRED_REPLY_DRAFT = '__EMAIL_DESK_DEFERRED__';

	/**
	 * @param array<string,mixed> $body Request body (raw triage object or { "triage": {...} }).
	 * @return array<string,mixed>
	 */
	public static function normalize( array $body ): array {
		$raw = isset( $body['triage'] ) && is_array( $body['triage'] ) ? $body['triage'] : $body;
		if ( ! is_array( $raw ) ) {
			return array(
				'ok'    => false,
				'error' => 'Triage response must be a JSON object.',
			);
		}

		if ( ! isset( $raw['actionable'] ) || ! is_bool( $raw['actionable'] ) ) {
			return array(
				'ok'    => false,
				'error' => 'OpenRouter triage missing actionable (boolean).',
			);
		}

		$summary = isset( $raw['summary'] ) ? trim( (string) $raw['summary'] ) : '';
		if ( $summary === '' ) {
			return array(
				'ok'    => false,
				'error' => 'OpenRouter triage missing summary.',
			);
		}

		$reply = isset( $raw['replyDraft'] ) ? trim( (string) $raw['replyDraft'] ) : '';
		if ( $reply === '' || $reply === self::DEFERRED_REPLY_DRAFT ) {
			$raw['replyDraft'] = self::DEFERRED_REPLY_DRAFT;
		} else {
			$raw['replyDraft'] = $reply;
		}

		return array(
			'ok'     => true,
			'triage' => $raw,
		);
	}
}
