<?php
/**
 * Google Ads campaign-scoped insights (daily series + scoped views).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Campaign_Insights {

	const KEYWORD_DAILY_KEY_CAP = 40;

	const RECOMMENDATION_LIMIT = 50;

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function fetch_campaign_insights( array $body ): array {
		$customer_id = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		if ( $customer_id === '' ) {
			return self::err( 400, 'Missing required field: customerId' );
		}

		$campaign_id_raw = trim( (string) ( $body['campaignId'] ?? '' ) );
		if ( $campaign_id_raw === '' || ! preg_match( '/^\d+$/', $campaign_id_raw ) ) {
			return self::err( 400, 'Missing or invalid field: campaignId' );
		}
		$campaign_id = (int) $campaign_id_raw;

		$start = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['startDate'] ?? '' ) );
		$end   = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['endDate'] ?? '' ) );
		if ( $start === '' || $end === '' ) {
			return self::err( 400, 'Invalid date range' );
		}

		$compare_start = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['compareStartDate'] ?? '' ) );
		$compare_end   = Neo_Pulse_App_Google_Ads_Credentials::validate_ymd( (string) ( $body['compareEndDate'] ?? '' ) );
		$has_compare   = $compare_start !== '' && $compare_end !== '';

		$meta = self::fetch_campaign_meta( $customer_id, $campaign_id );
		if ( empty( $meta['ok'] ) ) {
			return self::err( (int) ( $meta['statusCode'] ?? 502 ), (string) ( $meta['error'] ?? 'Ads campaign lookup failed' ) );
		}

		$primary = self::fetch_period( $customer_id, $campaign_id, $start, $end );
		if ( empty( $primary['ok'] ) ) {
			return self::err( (int) ( $primary['statusCode'] ?? 502 ), (string) ( $primary['error'] ?? 'Ads fetch failed' ) );
		}

		$recommendations = self::fetch_campaign_recommendations( $customer_id, $campaign_id );
		if ( empty( $recommendations['ok'] ) ) {
			return self::err( (int) ( $recommendations['statusCode'] ?? 502 ), (string) ( $recommendations['error'] ?? 'Ads recommendations fetch failed' ) );
		}

		$out = array(
			'success'                   => true,
			'customerId'                => $customer_id,
			'campaignId'                => (string) $campaign_id,
			'campaignName'              => $meta['name'],
			'campaignStatus'            => $meta['status'],
			'dailyBudgetMicros'         => $meta['dailyBudgetMicros'],
			'structureAdGroups'         => $meta['structureAdGroups'],
			'structureAds'              => $meta['structureAds'],
			'startDate'                 => $start,
			'endDate'                   => $end,
			'summary'                   => $primary['summary'],
			'dailySeries'               => $primary['dailySeries'],
			'adGroupDailySeriesById'    => $primary['adGroupDailySeriesById'],
			'keywordDailySeriesByKey'   => $primary['keywordDailySeriesByKey'],
			'adDailySeriesByKey'        => $primary['adDailySeriesByKey'],
			'keywords'                  => $primary['keywords'],
			'searchTerms'               => $primary['searchTerms'],
			'adGroups'                  => $primary['adGroups'],
			'recommendations'           => $recommendations['recommendations'],
		);

		if ( $has_compare ) {
			$compare = self::fetch_period( $customer_id, $campaign_id, $compare_start, $compare_end );
			if ( empty( $compare['ok'] ) ) {
				return self::err( (int) ( $compare['statusCode'] ?? 502 ), (string) ( $compare['error'] ?? 'Ads compare fetch failed' ) );
			}
			$out['compareStartDate'] = $compare_start;
			$out['compareEndDate']   = $compare_end;
			$out['compareSummary']   = $compare['summary'];
		}

		return $out;
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,name?:string,status?:string,dailyBudgetMicros?:int,structureAdGroups?:array<int,array<string,mixed>>}
	 */
	private static function fetch_campaign_meta( string $customer_id, int $campaign_id ): array {
		$meta_q = 'SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros FROM campaign WHERE campaign.id = '
			. $campaign_id;
		$meta   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $meta_q );
		if ( empty( $meta['ok'] ) ) {
			return $meta;
		}
		$rows = isset( $meta['results'] ) && is_array( $meta['results'] ) ? $meta['results'] : array();
		if ( $rows === array() ) {
			return array(
				'ok'         => false,
				'statusCode' => 404,
				'error'      => 'Google Ads campaign not found for this customer ID.',
			);
		}
		$row      = $rows[0];
		$campaign = isset( $row['campaign'] ) && is_array( $row['campaign'] ) ? $row['campaign'] : array();
		$budget   = isset( $row['campaignBudget'] ) && is_array( $row['campaignBudget'] ) ? $row['campaignBudget'] : array();
		$name     = trim( (string) ( $campaign['name'] ?? '' ) );
		$status   = trim( (string) ( $campaign['status'] ?? '' ) );
		if ( $name === '' ) {
			return array(
				'ok'         => false,
				'statusCode' => 404,
				'error'      => 'Google Ads campaign not found for this customer ID.',
			);
		}

		$ag_q = 'SELECT ad_group.id, ad_group.name, ad_group.status FROM ad_group WHERE campaign.id = ' . $campaign_id
			. " AND ad_group.status != 'REMOVED'";
		$ags  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $ag_q );
		if ( empty( $ags['ok'] ) ) {
			return $ags;
		}
		$ag_rows = isset( $ags['results'] ) && is_array( $ags['results'] ) ? $ags['results'] : array();

		$ads_q = 'SELECT ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.status, ad_group_ad.ad.type FROM ad_group_ad WHERE campaign.id = '
			. $campaign_id . " AND ad_group_ad.status != 'REMOVED' ORDER BY ad_group.name, ad_group_ad.ad.id";
		$ads_res = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $ads_q );
		if ( empty( $ads_res['ok'] ) ) {
			return $ads_res;
		}
		$ad_rows = isset( $ads_res['results'] ) && is_array( $ads_res['results'] ) ? $ads_res['results'] : array();

		return array(
			'ok'                => true,
			'name'              => $name,
			'status'            => $status !== '' ? $status : 'UNKNOWN',
			'dailyBudgetMicros' => (int) ( $budget['amountMicros'] ?? 0 ),
			'structureAdGroups' => self::map_structure_ad_groups( $ag_rows ),
			'structureAds'      => self::map_structure_ads( $ad_rows ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_structure_ads( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$ad_group = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$ad_group_ad = isset( $row['adGroupAd'] ) && is_array( $row['adGroupAd'] ) ? $row['adGroupAd'] : array();
			$ad          = isset( $ad_group_ad['ad'] ) && is_array( $ad_group_ad['ad'] ) ? $ad_group_ad['ad'] : array();
			$ag_id       = (string) ( $ad_group['id'] ?? '' );
			$ag_name     = trim( (string) ( $ad_group['name'] ?? '' ) );
			$ad_id       = (string) ( $ad['id'] ?? '' );
			if ( $ag_id === '' || $ad_id === '' ) {
				continue;
			}
			$type   = trim( (string) ( $ad['type'] ?? '' ) );
			$status = trim( (string) ( $ad_group_ad['status'] ?? '' ) );
			$type_label = $type === 'RESPONSIVE_SEARCH_AD' ? 'Responsive search ad' : 'Ad';
			$out[] = array(
				'adGroupId'   => $ag_id,
				'adGroupName' => $ag_name,
				'adId'        => $ad_id,
				'status'      => $status,
				'label'       => $ag_name !== '' ? $ag_name . ' · ' . $type_label . ' ' . $ad_id : $type_label . ' ' . $ad_id,
			);
		}
		return $out;
	}

	private static function map_structure_ad_groups( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$ad_group = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$name     = trim( (string) ( $ad_group['name'] ?? '' ) );
			if ( $name === '' ) {
				continue;
			}
			$out[] = array(
				'id'     => (string) ( $ad_group['id'] ?? '' ),
				'name'   => $name,
				'status' => trim( (string) ( $ad_group['status'] ?? '' ) ),
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	private static function filter_performance_rows( array $rows ): array {
		$out = array();
		foreach ( $rows as $row ) {
			$impressions = (int) ( $row['impressions'] ?? 0 );
			$clicks      = (int) ( $row['clicks'] ?? 0 );
			if ( $impressions > 0 || $clicks > 0 ) {
				$out[] = $row;
			}
		}
		return $out;
	}

	private static function fetch_period( string $customer_id, int $campaign_id, string $start, string $end ): array {
		$date_where     = "segments.date BETWEEN '" . $start . "' AND '" . $end . "'";
		$campaign_where = 'campaign.id = ' . $campaign_id . ' AND ' . $date_where;

		$daily_q = 'SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM campaign WHERE '
			. $campaign_where . ' ORDER BY segments.date ASC';
		$daily   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $daily_q );
		if ( empty( $daily['ok'] ) ) {
			return $daily;
		}

		$keyword_q = 'SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, campaign.name, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE '
			. $campaign_where . " AND campaign.status != 'REMOVED' ORDER BY metrics.clicks DESC LIMIT 100";
		$keywords  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $keyword_q );
		if ( empty( $keywords['ok'] ) ) {
			return $keywords;
		}

		$term_q = 'SELECT search_term_view.search_term, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM search_term_view WHERE '
			. $campaign_where . ' ORDER BY metrics.clicks DESC LIMIT 100';
		$terms  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $term_q );
		if ( empty( $terms['ok'] ) ) {
			return $terms;
		}

		$ag_q = 'SELECT ad_group.id, ad_group.name, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, metrics.conversions_value FROM ad_group WHERE '
			. $campaign_where . " AND ad_group.status != 'REMOVED' ORDER BY metrics.clicks DESC LIMIT 50";
		$ags  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $ag_q );
		if ( empty( $ags['ok'] ) ) {
			return $ags;
		}

		$ag_daily_q = 'SELECT segments.date, ad_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group WHERE '
			. $campaign_where . " AND ad_group.status != 'REMOVED' ORDER BY segments.date ASC";
		$ag_daily   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $ag_daily_q );
		if ( empty( $ag_daily['ok'] ) ) {
			return $ag_daily;
		}

		$kw_daily_q = 'SELECT segments.date, ad_group.id, ad_group_criterion.keyword.text, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM keyword_view WHERE '
			. $campaign_where . " AND campaign.status != 'REMOVED' ORDER BY segments.date ASC LIMIT 10000";
		$kw_daily   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $kw_daily_q );
		if ( empty( $kw_daily['ok'] ) ) {
			return $kw_daily;
		}

		$ad_daily_q = 'SELECT segments.date, ad_group.id, ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ad_group_ad WHERE '
			. $campaign_where . " AND ad_group_ad.status != 'REMOVED' ORDER BY segments.date ASC LIMIT 10000";
		$ad_daily   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $ad_daily_q );
		if ( empty( $ad_daily['ok'] ) ) {
			return $ad_daily;
		}

		$daily_rows = isset( $daily['results'] ) && is_array( $daily['results'] ) ? $daily['results'] : array();
		$kw_rows    = isset( $keywords['results'] ) && is_array( $keywords['results'] ) ? $keywords['results'] : array();
		$term_rows  = isset( $terms['results'] ) && is_array( $terms['results'] ) ? $terms['results'] : array();
		$ag_rows        = isset( $ags['results'] ) && is_array( $ags['results'] ) ? $ags['results'] : array();
		$ag_daily_rows  = isset( $ag_daily['results'] ) && is_array( $ag_daily['results'] ) ? $ag_daily['results'] : array();
		$kw_daily_rows  = isset( $kw_daily['results'] ) && is_array( $kw_daily['results'] ) ? $kw_daily['results'] : array();
		$ad_daily_rows  = isset( $ad_daily['results'] ) && is_array( $ad_daily['results'] ) ? $ad_daily['results'] : array();

		return array(
			'ok'                        => true,
			'summary'                   => Neo_Pulse_App_Google_Ads_Reporting_Bundle::sum_metrics( $daily_rows ),
			'dailySeries'               => self::map_daily_series( $daily_rows ),
			'adGroupDailySeriesById'    => self::map_ad_group_daily_series_by_id( $ag_daily_rows ),
			'keywordDailySeriesByKey'   => self::map_keyword_daily_series_by_key( $kw_daily_rows ),
			'adDailySeriesByKey'        => self::map_ad_daily_series_by_key( $ad_daily_rows ),
			'keywords'                  => self::filter_performance_rows(
				Neo_Pulse_App_Google_Ads_Reporting_Bundle::map_keywords( $kw_rows )
			),
			'searchTerms'               => self::filter_performance_rows(
				Neo_Pulse_App_Google_Ads_Reporting_Bundle::map_search_terms( $term_rows )
			),
			'adGroups'                  => self::filter_performance_rows( self::map_ad_groups( $ag_rows ) ),
		);
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,recommendations?:array<int,array<string,mixed>>}
	 */
	private static function fetch_campaign_recommendations( string $customer_id, int $campaign_id ): array {
		$query = 'SELECT recommendation.resource_name, recommendation.type, recommendation.campaign, recommendation.ad_group, recommendation.dismissed, recommendation.impact, recommendation.campaign_budget_recommendation, recommendation.keyword_recommendation, recommendation.responsive_search_ad_recommendation FROM recommendation WHERE recommendation.dismissed = FALSE AND campaign.id = '
			. $campaign_id . ' LIMIT ' . self::RECOMMENDATION_LIMIT;
		$res   = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $query );
		if ( empty( $res['ok'] ) ) {
			return $res;
		}
		$rows = isset( $res['results'] ) && is_array( $res['results'] ) ? $res['results'] : array();
		return array(
			'ok'              => true,
			'recommendations' => self::map_recommendations( $rows ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_recommendations( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$mapped = self::map_recommendation_row( $row );
			if ( $mapped !== null ) {
				$out[] = $mapped;
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $row
	 * @return array<string,mixed>|null
	 */
	private static function map_recommendation_row( array $row ): ?array {
		$rec = isset( $row['recommendation'] ) && is_array( $row['recommendation'] ) ? $row['recommendation'] : array();
		$type = trim( (string) ( $rec['type'] ?? '' ) );
		if ( $type === '' ) {
			return null;
		}
		$resource_name = trim( (string) ( $rec['resourceName'] ?? '' ) );
		$ad_group_id   = self::resource_id_from_name( (string) ( $rec['adGroup'] ?? '' ) );
		$impact        = isset( $rec['impact'] ) && is_array( $rec['impact'] ) ? $rec['impact'] : array();
		$base          = isset( $impact['baseMetrics'] ) && is_array( $impact['baseMetrics'] ) ? $impact['baseMetrics'] : array();
		$potential     = isset( $impact['potentialMetrics'] ) && is_array( $impact['potentialMetrics'] ) ? $impact['potentialMetrics'] : array();

		$title  = self::recommendation_type_label( $type );
		$detail = '';
		$keyword_text = '';

		$budget_rec = isset( $rec['campaignBudgetRecommendation'] ) && is_array( $rec['campaignBudgetRecommendation'] ) ? $rec['campaignBudgetRecommendation'] : array();
		if ( $budget_rec !== array() ) {
			$current = (int) ( $budget_rec['currentBudgetAmountMicros'] ?? 0 );
			$rec_amt = (int) ( $budget_rec['recommendedBudgetAmountMicros'] ?? 0 );
			if ( $rec_amt > 0 ) {
				$detail = 'Suggested daily budget ' . self::micros_to_currency( $rec_amt );
				if ( $current > 0 ) {
					$detail .= ' (current ' . self::micros_to_currency( $current ) . ')';
				}
			}
		}

		$kw_rec = isset( $rec['keywordRecommendation'] ) && is_array( $rec['keywordRecommendation'] ) ? $rec['keywordRecommendation'] : array();
		if ( $kw_rec !== array() ) {
			$kw_info = isset( $kw_rec['keyword'] ) && is_array( $kw_rec['keyword'] ) ? $kw_rec['keyword'] : array();
			$keyword_text = trim( (string) ( $kw_info['text'] ?? '' ) );
			$match        = trim( (string) ( $kw_info['matchType'] ?? '' ) );
			if ( $keyword_text !== '' ) {
				$detail = $keyword_text . ( $match !== '' ? ' (' . $match . ')' : '' );
			}
			$bid = (int) ( $kw_rec['recommendedCpcBidMicros'] ?? 0 );
			if ( $bid > 0 && $detail !== '' ) {
				$detail .= ' · bid ' . self::micros_to_currency( $bid );
			}
		}

		$rsa_rec = isset( $rec['responsiveSearchAdRecommendation'] ) && is_array( $rec['responsiveSearchAdRecommendation'] ) ? $rec['responsiveSearchAdRecommendation'] : array();
		if ( $rsa_rec !== array() && $detail === '' ) {
			$detail = 'Improve responsive search ad assets';
		}

		if ( $detail === '' ) {
			$detail = $title;
		}

		return array(
			'type'         => $type,
			'resourceName' => $resource_name,
			'title'        => $title,
			'detail'       => $detail,
			'adGroupId'    => $ad_group_id,
			'keywordText'  => $keyword_text,
			'impact'       => array(
				'baseClicks'      => (int) ( $base['clicks'] ?? 0 ),
				'potentialClicks' => (int) ( $potential['clicks'] ?? 0 ),
				'baseCostMicros'  => (int) ( $base['costMicros'] ?? 0 ),
			),
		);
	}

	private static function micros_to_currency( int $micros ): string {
		if ( $micros <= 0 ) {
			return '$0.00';
		}
		return '$' . number_format( $micros / 1_000_000, 2, '.', '' );
	}

	private static function recommendation_type_label( string $type ): string {
		$normalized = strtoupper( str_replace( ' ', '_', $type ) );
		$labels     = array(
			'CAMPAIGN_BUDGET'              => 'Campaign budget',
			'KEYWORD'                      => 'Keyword',
			'RESPONSIVE_SEARCH_AD'         => 'Responsive search ad',
			'RESPONSIVE_SEARCH_AD_ASSET'   => 'RSA asset',
			'TARGET_CPA_OPT_IN'            => 'Target CPA',
			'TARGET_ROAS_OPT_IN'           => 'Target ROAS',
			'MAXIMIZE_CONVERSIONS_OPT_IN'  => 'Maximize conversions',
			'MAXIMIZE_CLICKS_OPT_IN'       => 'Maximize clicks',
			'SITELINK_EXTENSION'           => 'Sitelink extension',
			'CALLOUT_EXTENSION'            => 'Callout extension',
			'USE_BROAD_MATCH_KEYWORD'      => 'Broad match keyword',
		);
		if ( isset( $labels[ $normalized ] ) ) {
			return $labels[ $normalized ];
		}
		$parts = explode( '_', strtolower( $normalized ) );
		return ucwords( implode( ' ', $parts ) );
	}

	private static function resource_id_from_name( string $resource_name ): string {
		if ( $resource_name === '' ) {
			return '';
		}
		if ( preg_match( '/\/adGroups\/(\d+)/', $resource_name, $m ) ) {
			return (string) $m[1];
		}
		return '';
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<string,array<int,array<string,mixed>>>
	 */
	private static function map_ad_group_daily_series_by_id( array $results ): array {
		$buckets = array();
		foreach ( $results as $row ) {
			$ad_group = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$id       = (string) ( $ad_group['id'] ?? '' );
			if ( $id === '' ) {
				continue;
			}
			$segments = isset( $row['segments'] ) && is_array( $row['segments'] ) ? $row['segments'] : array();
			$date     = (string) ( $segments['date'] ?? '' );
			if ( $date === '' ) {
				continue;
			}
			$m = Neo_Pulse_App_Google_Ads_Reporting_Bundle::metrics_of( $row );
			if ( ! isset( $buckets[ $id ] ) ) {
				$buckets[ $id ] = array();
			}
			$buckets[ $id ][] = array(
				'date'             => $date,
				'impressions'      => (int) $m['impressions'],
				'clicks'           => (int) $m['clicks'],
				'costMicros'       => (int) $m['costMicros'],
				'conversions'      => (float) $m['conversions'],
				'conversionsValue' => (float) $m['conversionsValue'],
			);
		}
		return $buckets;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<string,array<int,array<string,mixed>>>
	 */
	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<string,array<int,array<string,mixed>>>
	 */
	private static function map_ad_daily_series_by_key( array $results ): array {
		$buckets = array();
		foreach ( $results as $row ) {
			$ad_group    = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$ad_group_ad = isset( $row['adGroupAd'] ) && is_array( $row['adGroupAd'] ) ? $row['adGroupAd'] : array();
			$ad          = isset( $ad_group_ad['ad'] ) && is_array( $ad_group_ad['ad'] ) ? $ad_group_ad['ad'] : array();
			$ag_id       = (string) ( $ad_group['id'] ?? '' );
			$ad_id       = (string) ( $ad['id'] ?? '' );
			if ( $ag_id === '' || $ad_id === '' ) {
				continue;
			}
			$key = $ag_id . '|' . $ad_id;
			$segments = isset( $row['segments'] ) && is_array( $row['segments'] ) ? $row['segments'] : array();
			$date     = (string) ( $segments['date'] ?? '' );
			if ( $date === '' ) {
				continue;
			}
			$m = Neo_Pulse_App_Google_Ads_Reporting_Bundle::metrics_of( $row );
			if ( ! isset( $buckets[ $key ] ) ) {
				$buckets[ $key ] = array();
			}
			$buckets[ $key ][] = array(
				'date'             => $date,
				'impressions'      => (int) $m['impressions'],
				'clicks'           => (int) $m['clicks'],
				'costMicros'       => (int) $m['costMicros'],
				'conversions'      => (float) $m['conversions'],
				'conversionsValue' => (float) $m['conversionsValue'],
			);
		}
		return $buckets;
	}

	private static function map_keyword_daily_series_by_key( array $results ): array {
		$buckets   = array();
		$key_order = array();
		foreach ( $results as $row ) {
			$ad_group  = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$ag_id     = (string) ( $ad_group['id'] ?? '' );
			$criterion = isset( $row['adGroupCriterion'] ) && is_array( $row['adGroupCriterion'] ) ? $row['adGroupCriterion'] : array();
			$keyword   = isset( $criterion['keyword'] ) && is_array( $criterion['keyword'] ) ? $criterion['keyword'] : array();
			$text      = trim( (string) ( $keyword['text'] ?? '' ) );
			if ( $ag_id === '' || $text === '' ) {
				continue;
			}
			$key = $ag_id . '|' . $text;
			if ( ! isset( $buckets[ $key ] ) ) {
				if ( count( $key_order ) >= self::KEYWORD_DAILY_KEY_CAP ) {
					continue;
				}
				$key_order[]       = $key;
				$buckets[ $key ] = array();
			}
			$segments = isset( $row['segments'] ) && is_array( $row['segments'] ) ? $row['segments'] : array();
			$date     = (string) ( $segments['date'] ?? '' );
			if ( $date === '' ) {
				continue;
			}
			$m = Neo_Pulse_App_Google_Ads_Reporting_Bundle::metrics_of( $row );
			$buckets[ $key ][] = array(
				'date'             => $date,
				'impressions'      => (int) $m['impressions'],
				'clicks'           => (int) $m['clicks'],
				'costMicros'       => (int) $m['costMicros'],
				'conversions'      => (float) $m['conversions'],
				'conversionsValue' => (float) $m['conversionsValue'],
			);
		}
		return $buckets;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_daily_series( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$segments = isset( $row['segments'] ) && is_array( $row['segments'] ) ? $row['segments'] : array();
			$date     = (string) ( $segments['date'] ?? '' );
			if ( $date === '' ) {
				continue;
			}
			$m     = Neo_Pulse_App_Google_Ads_Reporting_Bundle::metrics_of( $row );
			$out[] = array(
				'date'             => $date,
				'impressions'      => (int) $m['impressions'],
				'clicks'           => (int) $m['clicks'],
				'costMicros'       => (int) $m['costMicros'],
				'conversions'      => (float) $m['conversions'],
				'conversionsValue' => (float) $m['conversionsValue'],
			);
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_ad_groups( array $results ): array {
		$out = array();
		foreach ( $results as $row ) {
			$ad_group = isset( $row['adGroup'] ) && is_array( $row['adGroup'] ) ? $row['adGroup'] : array();
			$out[]    = array_merge(
				Neo_Pulse_App_Google_Ads_Reporting_Bundle::metrics_of( $row ),
				array(
					'id'   => (string) ( $ad_group['id'] ?? '' ),
					'name' => (string) ( $ad_group['name'] ?? '' ),
				)
			);
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
