<?php
/**
 * Email desk Cursor cloud agent EMCP contract (allowlist, instructions, siteTasks shape).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Email_Desk_Cloud_Agent_Contract {

	/**
	 * @return string[]
	 */
	public static function allowlisted_emcp_tools(): array {
		return array(
			'emcp-tools-search-content',
			'emcp-tools-get-post',
			'emcp-tools-list-posts',
			'emcp-tools-update-post',
			'emcp-tools-get-page-structure',
			'emcp-tools-update-element',
			'emcp-tools-rankmath-read',
			'emcp-tools-rankmath-write',
		);
	}

	public static function cloud_agent_instructions(): string {
		return 'You work on one client site per task via that site\'s EMCP MCP server.

Execute every entry in siteTasks JSON in order. Do not send Gmail or email. Do not change unrelated sites.

For Rank Math meta description updates (Neo Pulse client WordPress sites):
1. emcp-tools-search-content to find the post (title or slug words).
2. post_id must be a positive integer. If you only have a slug, use emcp-tools-list-posts with search set to the slug.
3. emcp-tools-rankmath-write with operation update-post-seo and arguments post_id plus description.
4. Verify with emcp-tools-rankmath-read get-post-seo or the public page meta description tag.

Do not use emcp-tools-update-post meta_description (ignored). Do not write rank_math_description via update-post meta (protected). Do not probe Yoast keys or run SEO audit tools for a simple meta change.

After all siteTasks are done (verified or failed), end your final assistant message with exactly one fenced JSON block labeled email-desk-completion. No text after that fence.

The JSON must match: status ("ok" or "failed"), workSummary (one short line of what you did), replyDraft (plain-text customer reply when status is ok; empty string when failed).

replyDraft rules: only what the customer asked; quote verified meta description or other changed fields; do not mention title, URL, or slug unless they asked; sign off as Neo Digital. Do not send Gmail yourself.';
	}

	public static function openrouter_triage_instructions(): string {
		return 'Triage one inbound client email for Neo Digital Email desk.

Return JSON only. You MUST include replyDraft as an empty string "" (required field for the hub). Do not write any customer reply text at triage. Do not include proposedReply.

Customer Gmail copy is created only after the Cursor cloud agent finishes site work (email-desk-completion).

You MUST also include: actionable (boolean), summary (short internal line), siteKey (when known), siteTasks (array when actionable).

For Rank Math meta description work on Neo Pulse WordPress sites, siteTasks must use emcp-tools-rankmath-write (update-post-seo), not emcp-tools-update-post with meta_description. post_id must be a positive integer, not a slug.';
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function slack_ui(): array {
		return array(
			'version'            => 1,
			'initialCard'        => array(
				'showProposedReply'                  => false,
				'showReplyBodyInSlack'               => false,
				'showEditReplySlashCommand'          => false,
				'showWorkConfirmedSendReplyButton'   => false,
				'allowedSections'                    => array(
					'inboundMessage',
					'siteChecklist',
					'cursorCloudAgent',
				),
			),
			'postCompletionCard' => array(
				'showReplyBodyInSlack'             => false,
				'gmailDraftLinkOnly'               => true,
				'showWorkConfirmedSendReplyButton' => false,
			),
			'triageForbiddenFields'          => array( 'proposedReply' ),
			'hideProposedReplyWhenReplyDraftEmpty' => true,
		);
	}

	public static function proposed_reply_instructions(): string {
		return 'Reply only about fields the customer mentioned. No title, URL, or unchanged disclaimers unless they asked.';
	}

	/**
	 * @return array<int,array<string,mixed>>
	 */
	public static function meta_description_site_tasks( string $search_query, int $post_id, string $description ): array {
		$post_id = (int) $post_id;
		$description = trim( $description );
		$search_query = trim( $search_query );
		if ( $post_id <= 0 ) {
			throw new InvalidArgumentException( 'post_id must be a positive integer.' );
		}
		if ( $description === '' ) {
			throw new InvalidArgumentException( 'description is required.' );
		}
		if ( $search_query === '' ) {
			$search_query = substr( $description, 0, 80 );
		}
		return array(
			array(
				'tool'      => 'emcp-tools-search-content',
				'label'     => 'Find the blog post',
				'arguments' => array( 'query' => $search_query ),
			),
			array(
				'tool'      => 'emcp-tools-rankmath-write',
				'label'     => 'Update Rank Math meta description',
				'arguments' => array(
					'operation'  => 'update-post-seo',
					'arguments'  => array(
						'post_id'     => $post_id,
						'description' => $description,
					),
				),
			),
			array(
				'tool'      => 'emcp-tools-rankmath-read',
				'label'     => 'Verify Rank Math meta description',
				'arguments' => array(
					'operation'  => 'get-post-seo',
					'arguments'  => array( 'post_id' => $post_id ),
				),
			),
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function payload(): array {
		return array(
			'version'                    => 5,
			'allowlistedEmcpTools'       => self::allowlisted_emcp_tools(),
			'cloudAgentInstructions'     => self::cloud_agent_instructions(),
			'openRouterTriage'           => array(
				'instructions'       => self::openrouter_triage_instructions(),
				'requiredFields'     => array( 'actionable', 'summary', 'replyDraft' ),
				'forbiddenFields'    => array( 'proposedReply' ),
				'replyDraftPolicy'   => array(
					'mode'                => 'deferredEmptyString',
					'maxLengthAtTriage'   => 0,
				),
				'responseJsonSchema' => array(
					'type'                 => 'object',
					'required'             => array( 'actionable', 'summary', 'replyDraft' ),
					'properties'           => array(
						'replyDraft' => array(
							'type'        => 'string',
							'description' => 'Required. Must be empty at triage.',
						),
						'siteKey'    => array( 'type' => 'string' ),
						'siteTasks'  => array( 'type' => 'array' ),
						'actionable' => array( 'type' => 'boolean' ),
						'summary'    => array( 'type' => 'string' ),
					),
					'additionalProperties' => true,
				),
			),
			'slackUi'                    => self::slack_ui(),
			'replyDraftInstructions'     => self::proposed_reply_instructions(),
			'postCompletion'             => array(
				'version'                    => 1,
				'agentCompletionFence'       => Neo_Pulse_App_Email_Desk_Post_Completion::COMPLETION_FENCE,
				'agentCompletionJsonSchema'  => array(
					'type'                 => 'object',
					'required'             => array( 'status', 'workSummary', 'replyDraft' ),
					'properties'           => array(
						'status'       => array( 'type' => 'string', 'enum' => array( 'ok', 'failed' ) ),
						'workSummary'  => array( 'type' => 'string' ),
						'replyDraft'   => array( 'type' => 'string' ),
					),
					'additionalProperties' => false,
				),
				'hubSteps'                   => array(
					array(
						'id'    => 'parseCursorAgentFinalMessage',
						'parse' => Neo_Pulse_App_Email_Desk_Post_Completion::COMPLETION_FENCE,
					),
					array(
						'id'            => 'gmailCreateReplyDraft',
						'account'       => 'sean@neodigital.ca',
						'mcpServer'     => 'gmail-sean-neodigital',
						'bodyField'     => 'replyDraft',
						'threadIdField' => 'gmailThreadId',
					),
					array(
						'id'             => 'slackPostReplyDraftCard',
						'template'       => 'replyDraftReady',
						'channelField'   => 'slackChannelId',
						'threadTsField'  => 'slackThreadTs',
						'blocksFrom'     => 'buildSlackReplyDraftReadyBlocks',
					),
				),
				'gmailDraftWebUrlPattern'    => 'https://mail.google.com/mail/u/0/#drafts?compose={draftId}',
			),
			'metaDescriptionSiteTaskTemplate' => array(
				array(
					'tool'      => 'emcp-tools-search-content',
					'label'     => 'Find the blog post',
					'arguments' => array( 'query' => '<search query>' ),
				),
				array(
					'tool'      => 'emcp-tools-rankmath-write',
					'label'     => 'Update Rank Math meta description',
					'arguments' => array(
						'operation' => 'update-post-seo',
						'arguments'   => array(
							'post_id'     => '<positive integer post ID>',
							'description' => '<meta description>',
						),
					),
				),
				array(
					'tool'      => 'emcp-tools-rankmath-read',
					'label'     => 'Verify Rank Math meta description',
					'arguments' => array(
						'operation' => 'get-post-seo',
						'arguments' => array( 'post_id' => '<positive integer post ID>' ),
					),
				),
			),
		);
	}
}
