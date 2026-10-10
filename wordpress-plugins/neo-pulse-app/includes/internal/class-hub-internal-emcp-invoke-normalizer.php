<?php
/**
 * Normalize email-desk EMCP invoke payloads (slug post_id, meta_description → Rank Math).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Hub_Internal_Emcp_Invoke_Normalizer {

	/**
	 * @param array<string,mixed> $args
	 * @return array{tool:string,arguments:array<string,mixed>,warnings:string[]}
	 */
	public static function normalize( string $tool, array $args, callable $resolve_post_id ): array {
		$warnings = array();
		$args     = self::normalize_post_id_arg( $args, $resolve_post_id, $warnings );

		if ( $tool === 'emcp-tools-update-post' && isset( $args['meta_description'] ) ) {
			$description = trim( (string) $args['meta_description'] );
			unset( $args['meta_description'] );
			$post_id = isset( $args['post_id'] ) ? (int) $args['post_id'] : 0;
			if ( $post_id <= 0 ) {
				throw new InvalidArgumentException( 'meta_description update requires a numeric post_id.' );
			}
			if ( $description === '' ) {
				throw new InvalidArgumentException( 'meta_description must be non-empty.' );
			}
			$warnings[] = 'Rewrote emcp-tools-update-post meta_description to emcp-tools-rankmath-write update-post-seo.';
			return array(
				'tool'       => 'emcp-tools-rankmath-write',
				'arguments'  => array(
					'operation'  => 'update-post-seo',
					'arguments'  => array(
						'post_id'     => $post_id,
						'description' => $description,
					),
				),
				'warnings'   => $warnings,
			);
		}

		return array(
			'tool'      => $tool,
			'arguments' => $args,
			'warnings'  => $warnings,
		);
	}

	/**
	 * @param array<string,mixed> $args
	 * @param string[]            $warnings
	 * @return array<string,mixed>
	 */
	private static function normalize_post_id_arg( array $args, callable $resolve_post_id, array &$warnings ): array {
		if ( ! isset( $args['post_id'] ) ) {
			return $args;
		}
		$raw = $args['post_id'];
		if ( is_int( $raw ) && $raw > 0 ) {
			return $args;
		}
		if ( is_string( $raw ) && ctype_digit( $raw ) ) {
			$args['post_id'] = (int) $raw;
			return $args;
		}
		if ( is_string( $raw ) && trim( $raw ) !== '' ) {
			$slug = trim( $raw );
			$id   = (int) $resolve_post_id( $slug );
			if ( $id <= 0 ) {
				throw new InvalidArgumentException( 'Could not resolve post_id from slug: ' . $slug );
			}
			$args['post_id'] = $id;
			$warnings[]      = 'Resolved post_id slug "' . $slug . '" to ' . $id . '.';
			return $args;
		}
		throw new InvalidArgumentException( 'post_id must be a positive integer or a post slug string.' );
	}
}
