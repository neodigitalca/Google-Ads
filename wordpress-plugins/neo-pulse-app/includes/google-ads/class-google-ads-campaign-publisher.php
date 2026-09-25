<?php
/**
 * Publish a paused Search campaign from the PPC generator.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Campaign_Publisher {

	const MIN_DAILY_BUDGET   = 1;
	const MIN_HEADLINES      = 3;
	const MIN_DESCRIPTIONS   = 2;
	const MAX_CAMPAIGN_NAME  = 255;
	const MAX_HEADLINE       = 30;
	const MAX_DESCRIPTION    = 90;
	const MAX_PATH           = 15;
	const MAX_KEYWORD        = 80;

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function publish_campaign( array $body ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		if ( strlen( $customer_id ) !== 10 ) {
			return self::err( 400, 'Set a 10-digit Google Ads customer ID on this property.' );
		}

		$daily_budget = self::parse_daily_budget( $body['dailyBudget'] ?? null );
		if ( $daily_budget === null ) {
			return self::err( 400, 'Set a daily budget of at least ' . self::MIN_DAILY_BUDGET . ' before publishing.' );
		}

		$campaign = isset( $body['campaign'] ) && is_array( $body['campaign'] ) ? $body['campaign'] : null;
		if ( ! $campaign ) {
			return self::err( 400, 'Campaign payload is required.' );
		}

		$built = self::build_operations( $customer_id, $daily_budget, $campaign );
		if ( isset( $built['error'] ) ) {
			return self::err( 400, (string) $built['error'] );
		}

		$result = Neo_Pulse_App_Google_Ads_Api::mutate( $customer_id, $built['operations'] );
		if ( empty( $result['ok'] ) ) {
			return self::err( (int) ( $result['statusCode'] ?? 502 ), (string) ( $result['error'] ?? 'Google Ads publish failed.' ) );
		}

		$campaign_id = self::extract_campaign_id( is_array( $result['data'] ?? null ) ? $result['data'] : array() );
		if ( $campaign_id === '' ) {
			return self::err( 502, 'Google Ads mutate succeeded but returned no campaign ID.' );
		}

		return array(
			'success'               => true,
			'customerId'            => $customer_id,
			'campaignId'            => $campaign_id,
			'campaignResourceName'  => 'customers/' . $customer_id . '/campaigns/' . $campaign_id,
		);
	}

	/**
	 * Update name and daily budget on an existing Search campaign.
	 *
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function sync_campaign( array $body ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		if ( strlen( $customer_id ) !== 10 ) {
			return self::err( 400, 'Set a 10-digit Google Ads customer ID on this property.' );
		}

		$campaign_id = preg_replace( '/\D/', '', (string) ( $body['campaignId'] ?? '' ) );
		if ( $campaign_id === '' ) {
			return self::err( 400, 'campaignId is required to sync an existing Google Ads campaign.' );
		}

		$daily_budget = self::parse_daily_budget( $body['dailyBudget'] ?? null );
		if ( $daily_budget === null ) {
			return self::err( 400, 'Set a daily budget of at least ' . self::MIN_DAILY_BUDGET . ' before syncing.' );
		}

		$campaign = isset( $body['campaign'] ) && is_array( $body['campaign'] ) ? $body['campaign'] : null;
		if ( ! $campaign ) {
			return self::err( 400, 'Campaign payload is required.' );
		}

		$name = trim( (string) ( $campaign['name'] ?? '' ) );
		if ( $name === '' ) {
			return self::err( 400, 'Campaign name is required.' );
		}
		if ( self::char_count( $name ) > self::MAX_CAMPAIGN_NAME ) {
			return self::err( 400, 'Campaign name is too long (max ' . self::MAX_CAMPAIGN_NAME . ' characters).' );
		}

		$lookup = Neo_Pulse_App_Google_Ads_Api::search(
			$customer_id,
			'SELECT campaign.id, campaign.campaign_budget FROM campaign WHERE campaign.id = ' . $campaign_id
		);
		if ( empty( $lookup['ok'] ) ) {
			return self::err( (int) ( $lookup['statusCode'] ?? 502 ), (string) ( $lookup['error'] ?? 'Google Ads campaign lookup failed.' ) );
		}
		$results = isset( $lookup['results'] ) && is_array( $lookup['results'] ) ? $lookup['results'] : array();
		if ( ! $results ) {
			return self::err( 404, 'Google Ads campaign ' . $campaign_id . ' was not found on this customer account.' );
		}

		$row0          = $results[0];
		$campaign_meta = isset( $row0['campaign'] ) && is_array( $row0['campaign'] ) ? $row0['campaign'] : array();
		$budget_rn     = trim( (string) ( $campaign_meta['campaignBudget'] ?? '' ) );
		if ( $budget_rn === '' ) {
			return self::err( 502, 'Could not resolve the campaign budget for Google Ads campaign ' . $campaign_id . '.' );
		}

		$campaign_rn = 'customers/' . $customer_id . '/campaigns/' . $campaign_id;
		$amount      = (string) (int) round( $daily_budget * 1000000 );

		$operations = array(
			array(
				'campaignBudgetOperation' => array(
					'update'       => array(
						'resourceName' => $budget_rn,
						'amountMicros' => $amount,
					),
					'updateMask'   => 'amount_micros',
				),
			),
			array(
				'campaignOperation' => array(
					'update'     => array(
						'resourceName' => $campaign_rn,
						'name'         => $name,
					),
					'updateMask' => 'name',
				),
			),
		);

		$result = Neo_Pulse_App_Google_Ads_Api::mutate( $customer_id, $operations );
		if ( empty( $result['ok'] ) ) {
			return self::err( (int) ( $result['statusCode'] ?? 502 ), (string) ( $result['error'] ?? 'Google Ads sync failed.' ) );
		}

		return array(
			'success'    => true,
			'customerId' => $customer_id,
			'campaignId' => $campaign_id,
		);
	}

	/**
	 * @param mixed $raw
	 */
	private static function parse_daily_budget( $raw ): ?float {
		if ( ! is_numeric( $raw ) ) {
			return null;
		}
		$budget = (float) $raw;
		if ( ! is_finite( $budget ) || $budget < self::MIN_DAILY_BUDGET ) {
			return null;
		}
		return $budget;
	}

	/**
	 * @param array<string,mixed> $campaign
	 * @return array{operations?:array<int,array<string,mixed>>,error?:string}
	 */
	private static function build_operations( string $customer_id, float $daily_budget, array $campaign ): array {
		$name    = trim( (string) ( $campaign['name'] ?? '' ) );
		$network = (string) ( $campaign['network'] ?? '' );
		if ( $name === '' ) {
			return array( 'error' => 'Campaign name is required.' );
		}
		if ( self::char_count( $name ) > self::MAX_CAMPAIGN_NAME ) {
			return array( 'error' => 'Campaign name is too long (max ' . self::MAX_CAMPAIGN_NAME . ' characters).' );
		}
		if ( $network !== 'SEARCH' ) {
			return array( 'error' => 'Only Search campaigns can be published.' );
		}
		$ad_groups = isset( $campaign['adGroups'] ) && is_array( $campaign['adGroups'] ) ? $campaign['adGroups'] : array();
		if ( ! $ad_groups ) {
			return array( 'error' => 'Add at least one ad group before publishing.' );
		}

		$budget_rn   = 'customers/' . $customer_id . '/campaignBudgets/-1';
		$campaign_rn = 'customers/' . $customer_id . '/campaigns/-2';
		$amount      = (string) (int) round( $daily_budget * 1000000 );

		$operations   = array();
		$operations[] = array(
			'campaignBudgetOperation' => array(
				'create' => array(
					'resourceName'     => $budget_rn,
					'name'             => $name . ' budget',
					'amountMicros'     => $amount,
					'deliveryMethod'   => 'STANDARD',
					'explicitlyShared' => false,
				),
			),
		);
		$operations[] = array(
			'campaignOperation' => array(
				'create' => array(
					'resourceName'                     => $campaign_rn,
					'name'                             => $name,
					'status'                           => 'PAUSED',
					'advertisingChannelType'           => 'SEARCH',
					'campaignBudget'                   => $budget_rn,
					'targetSpend'                      => new stdClass(),
					'networkSettings'                  => array(
						'targetGoogleSearch'          => true,
						'targetSearchNetwork'         => true,
						'targetContentNetwork'        => false,
						'targetPartnerSearchNetwork'  => false,
					),
					'containsEuPoliticalAdvertising'   => 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
				),
			),
		);

		$next_temp = -3;
		foreach ( $ad_groups as $ad_group ) {
			if ( ! is_array( $ad_group ) ) {
				return array( 'error' => 'Ad group payload is invalid.' );
			}
			$group_ops = self::ad_group_operations( $customer_id, $campaign_rn, $ad_group, $next_temp );
			if ( isset( $group_ops['error'] ) ) {
				return $group_ops;
			}
			foreach ( $group_ops['operations'] as $op ) {
				$operations[] = $op;
			}
			$next_temp = $group_ops['nextTemp'];
		}

		return array( 'operations' => $operations );
	}

	/**
	 * @param array<string,mixed> $ad_group
	 * @return array{operations?:array<int,array<string,mixed>>,nextTemp?:int,error?:string}
	 */
	private static function ad_group_operations( string $customer_id, string $campaign_rn, array $ad_group, int $temp_id ): array {
		$group_name = trim( (string) ( $ad_group['name'] ?? '' ) );
		if ( $group_name === '' ) {
			return array( 'error' => 'Every ad group needs a name.' );
		}
		$keywords = self::phrase_keyword_texts( isset( $ad_group['keywords'] ) && is_array( $ad_group['keywords'] ) ? $ad_group['keywords'] : array() );
		if ( isset( $keywords['error'] ) ) {
			return array( 'error' => $group_name . ': ' . (string) $keywords['error'] );
		}
		if ( empty( $keywords['keywords'] ) ) {
			return array( 'error' => $group_name . ': add at least one keyword before publishing.' );
		}
		$keywords = $keywords['keywords'];
		$ads = isset( $ad_group['ads'] ) && is_array( $ad_group['ads'] ) ? $ad_group['ads'] : array();
		if ( ! $ads ) {
			return array( 'error' => $group_name . ': add at least one responsive search ad before publishing.' );
		}

		$group_rn     = 'customers/' . $customer_id . '/adGroups/' . $temp_id;
		$operations   = array();
		$operations[] = array(
			'adGroupOperation' => array(
				'create' => array(
					'resourceName' => $group_rn,
					'name'         => $group_name,
					'campaign'     => $campaign_rn,
					'status'       => 'ENABLED',
					'type'         => 'SEARCH_STANDARD',
				),
			),
		);

		foreach ( $keywords as $keyword ) {
			$operations[] = array(
				'adGroupCriterionOperation' => array(
					'create' => array(
						'adGroup' => $group_rn,
						'status'  => 'ENABLED',
						'keyword' => array(
							'text'      => $keyword,
							'matchType' => 'PHRASE',
						),
					),
				),
			);
		}

		foreach ( $ads as $ad ) {
			if ( ! is_array( $ad ) ) {
				return array( 'error' => $group_name . ': responsive search ad payload is invalid.' );
			}
			$ad_op = self::rsa_operation( $group_rn, $group_name, $ad );
			if ( isset( $ad_op['error'] ) ) {
				return $ad_op;
			}
			$operations[] = $ad_op['operation'];
		}

		return array(
			'operations' => $operations,
			'nextTemp'   => $temp_id - 1,
		);
	}

	/**
	 * @param array<string,mixed> $ad
	 * @return array{operation?:array<string,mixed>,error?:string}
	 */
	private static function rsa_operation( string $group_rn, string $group_name, array $ad ): array {
		$headlines = self::text_assets( isset( $ad['headlines'] ) && is_array( $ad['headlines'] ) ? $ad['headlines'] : array() );
		if ( count( $headlines ) < self::MIN_HEADLINES ) {
			return array( 'error' => $group_name . ': each responsive search ad needs at least ' . self::MIN_HEADLINES . ' headlines.' );
		}
		$over_headline = self::first_over_limit( $headlines, self::MAX_HEADLINE, 'text' );
		if ( $over_headline !== null ) {
			return array( 'error' => $group_name . ': headline is too long (max ' . self::MAX_HEADLINE . ' characters): ' . $over_headline );
		}
		$descriptions = self::text_assets( isset( $ad['descriptions'] ) && is_array( $ad['descriptions'] ) ? $ad['descriptions'] : array() );
		if ( count( $descriptions ) < self::MIN_DESCRIPTIONS ) {
			return array( 'error' => $group_name . ': each responsive search ad needs at least ' . self::MIN_DESCRIPTIONS . ' descriptions.' );
		}
		$over_description = self::first_over_limit( $descriptions, self::MAX_DESCRIPTION, 'text' );
		if ( $over_description !== null ) {
			return array( 'error' => $group_name . ': description is too long (max ' . self::MAX_DESCRIPTION . ' characters): ' . $over_description );
		}
		$final_url = trim( (string) ( $ad['finalUrl'] ?? '' ) );
		if ( $final_url === '' ) {
			return array( 'error' => $group_name . ': each responsive search ad needs a final URL.' );
		}

		$rsa = array(
			'headlines'    => $headlines,
			'descriptions' => $descriptions,
		);
		$path1 = trim( (string) ( $ad['path1'] ?? '' ) );
		$path2 = trim( (string) ( $ad['path2'] ?? '' ) );
		if ( $path1 !== '' ) {
			if ( self::char_count( $path1 ) > self::MAX_PATH ) {
				return array( 'error' => $group_name . ': path1 is too long (max ' . self::MAX_PATH . ' characters).' );
			}
			$rsa['path1'] = $path1;
		}
		if ( $path2 !== '' ) {
			if ( self::char_count( $path2 ) > self::MAX_PATH ) {
				return array( 'error' => $group_name . ': path2 is too long (max ' . self::MAX_PATH . ' characters).' );
			}
			$rsa['path2'] = $path2;
		}

		return array(
			'operation' => array(
				'adGroupAdOperation' => array(
					'create' => array(
						'adGroup' => $group_rn,
						'status'  => 'ENABLED',
						'ad'      => array(
							'responsiveSearchAd' => $rsa,
							'finalUrls'          => array( $final_url ),
						),
					),
				),
			),
		);
	}

	/**
	 * Phrase match is set on the criterion. Keyword text is the query only.
	 *
	 * @param array<int,mixed> $values
	 * @return array{keywords?:array<int,string>,error?:string}
	 */
	private static function phrase_keyword_texts( array $values ): array {
		$out  = array();
		$seen = array();
		foreach ( $values as $value ) {
			$text = self::keyword_query_text( (string) $value );
			if ( $text === '' ) {
				continue;
			}
			if ( self::char_count( $text ) > self::MAX_KEYWORD ) {
				return array( 'error' => 'keyword is too long (max ' . self::MAX_KEYWORD . ' characters): ' . $text );
			}
			$key = strtolower( $text );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $text;
		}
		return array( 'keywords' => $out );
	}

	/**
	 * @param array<int,array{text:string}> $assets
	 */
	private static function first_over_limit( array $assets, int $max, string $key ): ?string {
		foreach ( $assets as $asset ) {
			$text = trim( (string) ( $asset[ $key ] ?? '' ) );
			if ( $text !== '' && self::char_count( $text ) > $max ) {
				return $text;
			}
		}
		return null;
	}

	private static function char_count( string $text ): int {
		return (int) mb_strlen( $text, 'UTF-8' );
	}

	private static function keyword_query_text( string $raw ): string {
		$text = trim( $raw );
		$len  = strlen( $text );
		if ( $len >= 2 ) {
			$first = $text[0];
			$last  = $text[ $len - 1 ];
			if ( ( $first === '"' && $last === '"' ) || ( $first === '[' && $last === ']' ) ) {
				$text = trim( substr( $text, 1, $len - 2 ) );
			}
		}
		return $text;
	}

	/**
	 * @param array<int,mixed> $values
	 * @return array<int,string>
	 */
	private static function trimmed_strings( array $values ): array {
		$out = array();
		foreach ( $values as $value ) {
			$text = trim( (string) $value );
			if ( $text !== '' ) {
				$out[] = $text;
			}
		}
		return $out;
	}

	/**
	 * @param array<int,mixed> $values
	 * @return array<int,array{text:string}>
	 */
	private static function text_assets( array $values ): array {
		$out = array();
		foreach ( self::trimmed_strings( $values ) as $text ) {
			$out[] = array( 'text' => $text );
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $data
	 */
	private static function extract_campaign_id( array $data ): string {
		$responses = isset( $data['mutateOperationResponses'] ) && is_array( $data['mutateOperationResponses'] )
			? $data['mutateOperationResponses']
			: array();
		foreach ( $responses as $response ) {
			if ( ! is_array( $response ) ) {
				continue;
			}
			$result = isset( $response['campaignResult'] ) && is_array( $response['campaignResult'] )
				? $response['campaignResult']
				: null;
			if ( ! $result ) {
				continue;
			}
			$resource = trim( (string) ( $result['resourceName'] ?? '' ) );
			if ( $resource === '' ) {
				continue;
			}
			$parts = explode( '/', $resource );
			$id    = (string) end( $parts );
			if ( $id !== '' && ctype_digit( $id ) ) {
				return $id;
			}
		}
		return '';
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function err( int $status, string $message ): array {
		return array(
			'success'    => false,
			'error'      => $message,
			'statusCode' => $status,
		);
	}
}
