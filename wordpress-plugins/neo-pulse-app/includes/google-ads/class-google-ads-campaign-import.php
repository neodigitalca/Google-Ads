<?php
/**
 * Import existing Google Ads Search campaigns into PPC rows.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Campaign_Import {

	const IMPORT_LIMIT = 50;

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function import_search_campaigns( array $body ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		if ( strlen( $customer_id ) !== 10 ) {
			return self::err( 400, 'Set a 10-digit Google Ads customer ID on this property.' );
		}

		$list_q = "SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.advertising_channel_type = 'SEARCH' AND campaign.status != 'REMOVED' ORDER BY campaign.name LIMIT "
			. self::IMPORT_LIMIT;
		$list   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $list_q );
		if ( empty( $list['ok'] ) ) {
			return self::err( (int) ( $list['statusCode'] ?? 502 ), (string) ( $list['error'] ?? 'Google Ads campaign list failed.' ) );
		}

		$rows = isset( $list['results'] ) && is_array( $list['results'] ) ? $list['results'] : array();
		if ( $rows === array() ) {
			return array(
				'success'   => true,
				'customerId' => $customer_id,
				'campaigns' => array(),
			);
		}

		$out = array();
		foreach ( $rows as $row ) {
			$campaign = isset( $row['campaign'] ) && is_array( $row['campaign'] ) ? $row['campaign'] : array();
			$budget   = isset( $row['campaignBudget'] ) && is_array( $row['campaignBudget'] ) ? $row['campaignBudget'] : array();
			$id       = (string) ( $campaign['id'] ?? '' );
			$name     = trim( (string) ( $campaign['name'] ?? '' ) );
			if ( $id === '' || $name === '' ) {
				continue;
			}
			$built = self::build_campaign_payload( $customer_id, (int) $id, $name, $budget );
			if ( empty( $built['ok'] ) ) {
				return self::err( (int) ( $built['statusCode'] ?? 502 ), (string) ( $built['error'] ?? 'Google Ads import failed.' ) );
			}
			$out[] = array(
				'campaignId'  => $id,
				'name'        => $name,
				'status'      => trim( (string) ( $campaign['status'] ?? '' ) ),
				'dailyBudget' => (int) ( $built['dailyBudget'] ?? 1 ),
				'campaign'    => $built['campaign'],
			);
		}

		return array(
			'success'    => true,
			'customerId' => $customer_id,
			'campaigns'  => $out,
		);
	}

	/**
	 * @param array<string,mixed> $budget_row
	 * @return array{ok:bool,statusCode?:int,error?:string,dailyBudget?:int,campaign?:array<string,mixed>}
	 */
	private static function build_campaign_payload( string $customer_id, int $campaign_id, string $name, array $budget_row ): array {
		$micros        = (int) ( $budget_row['amountMicros'] ?? 0 );
		$daily_budget  = $micros > 0 ? max( 1, (int) round( $micros / 1_000_000 ) ) : 1;
		$ad_groups     = self::fetch_ad_groups( $customer_id, $campaign_id );
		if ( empty( $ad_groups['ok'] ) ) {
			return $ad_groups;
		}
		$keywords = self::fetch_keywords( $customer_id, $campaign_id );
		if ( empty( $keywords['ok'] ) ) {
			return $keywords;
		}
		$ads = self::fetch_rsas( $customer_id, $campaign_id );
		if ( empty( $ads['ok'] ) ) {
			return $ads;
		}

		$groups_out = array();
		foreach ( $ad_groups['groups'] as $group ) {
			$gid   = (string) ( $group['id'] ?? '' );
			$gname = (string) ( $group['name'] ?? '' );
			if ( $gid === '' || $gname === '' ) {
				continue;
			}
			$kw_list = isset( $keywords['byGroup'][ $gid ] ) ? $keywords['byGroup'][ $gid ] : array();
			$ad_list = isset( $ads['byGroup'][ $gid ] ) ? $ads['byGroup'][ $gid ] : array();
			$landing = '';
			if ( $ad_list !== array() && isset( $ad_list[0]['finalUrl'] ) ) {
				$landing = (string) $ad_list[0]['finalUrl'];
			}
			$groups_out[] = array(
				'id'             => $gid,
				'name'           => $gname,
				'landingPageUrl' => $landing,
				'keywords'       => $kw_list,
				'ads'            => $ad_list,
			);
		}

		if ( $groups_out === array() ) {
			$groups_out[] = array(
				'id'             => 'import-' . $campaign_id,
				'name'           => $name,
				'landingPageUrl' => '',
				'keywords'       => array(),
				'ads'            => array(),
			);
		}

		return array(
			'ok'           => true,
			'dailyBudget'  => $daily_budget,
			'campaign'     => array(
				'name'     => $name,
				'network'  => 'SEARCH',
				'adGroups' => $groups_out,
			),
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,groups?:array<int,array<string,mixed>>}
	 */
	private static function fetch_ad_groups( string $customer_id, int $campaign_id ): array {
		$q = 'SELECT ad_group.id, ad_group.name FROM ad_group WHERE campaign.id = ' . $campaign_id
			. " AND ad_group.status != 'REMOVED' ORDER BY ad_group.name";
		$res = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $q );
		if ( empty( $res['ok'] ) ) {
			return $res;
		}
		$groups = array();
		foreach ( isset( $res['results'] ) && is_array( $res['results'] ) ? $res['results'] : array() as $row ) {
			$ag = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$groups[] = array(
				'id'   => (string) ( $ag['id'] ?? '' ),
				'name' => trim( (string) ( $ag['name'] ?? '' ) ),
			);
		}
		return array(
			'ok'     => true,
			'groups' => $groups,
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,byGroup?:array<string,array<int,string>>}
	 */
	private static function fetch_keywords( string $customer_id, int $campaign_id ): array {
		$q = 'SELECT ad_group.id, ad_group_criterion.keyword.text FROM ad_group_criterion WHERE campaign.id = ' . $campaign_id
			. " AND ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'";
		$res = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $q );
		if ( empty( $res['ok'] ) ) {
			return $res;
		}
		$by_group = array();
		foreach ( isset( $res['results'] ) && is_array( $res['results'] ) ? $res['results'] : array() as $row ) {
			$ag        = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$gid       = (string) ( $ag['id'] ?? '' );
			$criterion = isset( $row['adGroupCriterion'] ) && is_array( $row['adGroupCriterion'] ) ? $row['adGroupCriterion'] : array();
			$keyword   = isset( $criterion['keyword'] ) && is_array( $criterion['keyword'] ) ? $criterion['keyword'] : array();
			$text      = trim( (string) ( $keyword['text'] ?? '' ) );
			if ( $gid === '' || $text === '' ) {
				continue;
			}
			if ( ! isset( $by_group[ $gid ] ) ) {
				$by_group[ $gid ] = array();
			}
			if ( ! in_array( $text, $by_group[ $gid ], true ) ) {
				$by_group[ $gid ][] = $text;
			}
		}
		return array(
			'ok'      => true,
			'byGroup' => $by_group,
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,byGroup?:array<string,array<int,array<string,mixed>>>}
	 */
	private static function fetch_rsas( string $customer_id, int $campaign_id ): array {
		$q = 'SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions, ad_group_ad.ad.responsive_search_ad.path1, ad_group_ad.ad.responsive_search_ad.path2 FROM ad_group_ad WHERE campaign.id = '
			. $campaign_id . " AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD' AND ad_group_ad.status != 'REMOVED'";
		$res = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $q );
		if ( empty( $res['ok'] ) ) {
			return $res;
		}
		$by_group = array();
		foreach ( isset( $res['results'] ) && is_array( $res['results'] ) ? $res['results'] : array() as $row ) {
			$ag  = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$gid = (string) ( $ag['id'] ?? '' );
			$ad  = isset( $row['adGroupAd'] ) && is_array( $row['adGroupAd'] ) ? $row['adGroupAd'] : array();
			$ad_inner = isset( $ad['ad'] ) && is_array( $ad['ad'] ) ? $ad['ad'] : array();
			if ( $gid === '' ) {
				continue;
			}
			$final_urls = isset( $ad_inner['finalUrls'] ) && is_array( $ad_inner['finalUrls'] ) ? $ad_inner['finalUrls'] : array();
			$final_url  = isset( $final_urls[0] ) ? trim( (string) $final_urls[0] ) : '';
			$rsa        = isset( $ad_inner['responsiveSearchAd'] ) && is_array( $ad_inner['responsiveSearchAd'] ) ? $ad_inner['responsiveSearchAd'] : array();
			$headlines  = self::extract_ad_texts( isset( $rsa['headlines'] ) ? $rsa['headlines'] : array() );
			$descriptions = self::extract_ad_texts( isset( $rsa['descriptions'] ) ? $rsa['descriptions'] : array() );
			if ( ! isset( $by_group[ $gid ] ) ) {
				$by_group[ $gid ] = array();
			}
			$by_group[ $gid ][] = array(
				'id'           => (string) ( $ad_inner['id'] ?? '' ),
				'headlines'    => $headlines,
				'descriptions' => $descriptions,
				'finalUrl'     => $final_url,
				'path1'        => trim( (string) ( $rsa['path1'] ?? '' ) ),
				'path2'        => trim( (string) ( $rsa['path2'] ?? '' ) ),
			);
		}
		return array(
			'ok'      => true,
			'byGroup' => $by_group,
		);
	}

	/**
	 * @param array<int,mixed> $assets
	 * @return array<int,string>
	 */
	private static function extract_ad_texts( array $assets ): array {
		$out = array();
		foreach ( $assets as $asset ) {
			if ( is_string( $asset ) ) {
				$text = trim( $asset );
				if ( $text !== '' ) {
					$out[] = $text;
				}
				continue;
			}
			if ( ! is_array( $asset ) ) {
				continue;
			}
			if ( isset( $asset['text'] ) && is_string( $asset['text'] ) ) {
				$text = trim( $asset['text'] );
				if ( $text !== '' ) {
					$out[] = $text;
				}
				continue;
			}
			if ( isset( $asset['asset'] ) && is_array( $asset['asset'] ) && isset( $asset['asset']['text'] ) ) {
				$text = trim( (string) $asset['asset']['text'] );
				if ( $text !== '' ) {
					$out[] = $text;
				}
			}
		}
		return $out;
	}

	/**
	 * @return array<string,mixed>
	 */
	private static function err( int $status, string $message ): array {
		return array(
			'success'    => false,
			'statusCode' => $status,
			'error'      => $message,
		);
	}
}
