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

Do not use emcp-tools-update-post meta_description (ignored). Do not write rank_math_description via update-post meta (protected). Do not probe Yoast keys or run SEO audit tools for a simple meta change.';
	}

	public static function openrouter_triage_instructions(): string {
		return 'Triage one inbound client email for Neo Digital Email desk.

Return JSON only. You MUST include a non-empty string field replyDraft: a short Gmail reply to the sender (plain text, sign off as Neo Digital). replyDraft is required even when the work will run on a Cursor cloud agent later.

Reply copy rules: only discuss what the customer asked (e.g. meta description updated + quote the new text). Do not mention page title, URL, or slug unless they asked.

For Rank Math meta description work on Neo Pulse WordPress sites, siteTasks must use emcp-tools-rankmath-write (update-post-seo), not emcp-tools-update-post with meta_description. post_id must be a positive integer, not a slug.';
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
			'version'                    => 2,
			'allowlistedEmcpTools'       => self::allowlisted_emcp_tools(),
			'cloudAgentInstructions'     => self::cloud_agent_instructions(),
			'openRouterTriage'           => array(
				'instructions'       => self::openrouter_triage_instructions(),
				'requiredFields'     => array( 'replyDraft' ),
				'responseJsonSchema' => array(
					'type'                 => 'object',
					'required'             => array( 'replyDraft' ),
					'properties'           => array(
						'replyDraft' => array(
							'type'        => 'string',
							'description' => 'Gmail reply body for the sender (required, non-empty).',
						),
					),
					'additionalProperties' => true,
				),
			),
			'proposedReplyInstructions'  => self::proposed_reply_instructions(),
			'replyDraftInstructions'     => self::proposed_reply_instructions(),
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
