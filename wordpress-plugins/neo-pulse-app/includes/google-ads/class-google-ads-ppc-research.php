<?php
/**
 * Aggregate PPC research signals (Google Ads GAQL, DataForSEO, client GSC).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Google_Ads_Ppc_Research {

	/**
	 * @param array<string,mixed> $body
	 * @return array<string,mixed>
	 */
	public static function fetch_signals( array $body ): array {
		$focus = trim( (string) ( $body['focusKeyword'] ?? '' ) );
		if ( $focus === '' ) {
			return self::err( 400, 'Missing required field: focusKeyword' );
		}

		$location_name  = trim( (string) ( $body['locationName'] ?? 'United States' ) );
		$language_code  = Neo_Pulse_App_Dataforseo_Client::ensure_language_code( $body['languageCode'] ?? 'en' );
		$customer_id    = Neo_Pulse_App_Google_Ads_Credentials::normalize_customer_id( (string) ( $body['customerId'] ?? '' ) );
		$landing_urls   = self::string_list( $body['landingPageUrls'] ?? array() );
		$gsc_queries    = self::normalize_gsc_queries( $body['gscQueries'] ?? array() );

		$has_dfs = Neo_Pulse_App_Dataforseo_Client::has_credentials();
		$ads_status = Neo_Pulse_App_Google_Ads_Oauth::connection_status();
		$has_ads   = ! empty( $ads_status['connected'] ) && strlen( $customer_id ) === 10;

		if ( ! $has_dfs && ! $has_ads && $gsc_queries === array() ) {
			return self::err(
				503,
				'PPC research requires DataForSEO credentials, a connected Google Ads account with customer ID, or GSC queries from Generate.'
			);
		}

		$account_keywords     = array();
		$account_search_terms = array();
		$dfs_ideas            = array();
		$dfs_google_ads       = array();
		$serp_paid            = array();

		if ( $has_ads ) {
			$ads = self::fetch_ads_account_signals( $customer_id, $focus );
			if ( empty( $ads['ok'] ) ) {
				return self::err( (int) ( $ads['statusCode'] ?? 502 ), (string) ( $ads['error'] ?? 'Google Ads research failed.' ) );
			}
			$account_keywords     = $ads['accountKeywords'];
			$account_search_terms = $ads['accountSearchTerms'];
		}

		if ( $has_dfs ) {
			$dfs = self::fetch_dfs_signals( $focus, $location_name, $language_code );
			if ( empty( $dfs['ok'] ) ) {
				return self::err( (int) ( $dfs['statusCode'] ?? 502 ), (string) ( $dfs['error'] ?? 'DataForSEO research failed.' ) );
			}
			$dfs_ideas      = $dfs['dfsKeywordIdeas'];
			$dfs_google_ads = $dfs['dfsGoogleAdsKeywords'];
			$serp_paid      = $dfs['serpPaidAds'];
		}

		$signals = array(
			'focusKeyword'         => $focus,
			'locationName'         => $location_name,
			'languageCode'         => $language_code,
			'landingPageUrls'      => $landing_urls,
			'gscQueries'           => $gsc_queries,
			'dfsKeywordIdeas'      => $dfs_ideas,
			'dfsGoogleAdsKeywords' => $dfs_google_ads,
			'accountKeywords'      => $account_keywords,
			'accountSearchTerms'   => $account_search_terms,
			'serpPaidAds'          => $serp_paid,
		);

		if ( ! self::has_any_signal_rows( $signals ) ) {
			return self::err( 422, 'No PPC research signals returned for this focus keyword. Check integrations and try again.' );
		}

		return array(
			'success' => true,
			'signals' => $signals,
		);
	}

	/**
	 * @param array<string,mixed> $signals
	 */
	private static function has_any_signal_rows( array $signals ): bool {
		foreach ( array( 'gscQueries', 'dfsKeywordIdeas', 'dfsGoogleAdsKeywords', 'accountKeywords', 'accountSearchTerms', 'serpPaidAds' ) as $key ) {
			if ( ! empty( $signals[ $key ] ) && is_array( $signals[ $key ] ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,accountKeywords?:array<int,array<string,mixed>>,accountSearchTerms?:array<int,array<string,mixed>>}
	 */
	private static function fetch_ads_account_signals( string $customer_id, string $focus ): array {
		$end   = gmdate( 'Y-m-d' );
		$start = gmdate( 'Y-m-d', strtotime( '-30 days' ) );
		$where = "segments.date BETWEEN '" . $start . "' AND '" . $end . "'";

		$keyword_q = 'SELECT ad_group_criterion.keyword.text, metrics.clicks, metrics.impressions, metrics.average_cpc FROM keyword_view WHERE '
			. $where . " AND campaign.status != 'REMOVED' ORDER BY metrics.clicks DESC LIMIT 200";
		$keywords  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $keyword_q );
		if ( empty( $keywords['ok'] ) ) {
			return $keywords;
		}

		$term_q = 'SELECT search_term_view.search_term, metrics.clicks, metrics.impressions, metrics.cost_micros FROM search_term_view WHERE '
			. $where . ' ORDER BY metrics.clicks DESC LIMIT 200';
		$terms  = Neo_Pulse_App_Google_Ads_Api::search( $customer_id, $term_q );
		if ( empty( $terms['ok'] ) ) {
			return $terms;
		}

		$kw_rows = isset( $keywords['results'] ) && is_array( $keywords['results'] ) ? $keywords['results'] : array();
		$term_rows = isset( $terms['results'] ) && is_array( $terms['results'] ) ? $terms['results'] : array();

		return array(
			'ok'                   => true,
			'accountKeywords'      => self::map_ads_keywords( $kw_rows, $focus, 20 ),
			'accountSearchTerms'   => self::map_ads_search_terms( $term_rows, $focus, 20 ),
		);
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_ads_keywords( array $results, string $focus, int $limit ): array {
		$out = array();
		foreach ( $results as $row ) {
			$criterion = isset( $row['adGroupCriterion'] ) && is_array( $row['adGroupCriterion'] ) ? $row['adGroupCriterion'] : array();
			$keyword   = isset( $criterion['keyword'] ) && is_array( $criterion['keyword'] ) ? $criterion['keyword'] : array();
			$text      = trim( (string) ( $keyword['text'] ?? '' ) );
			if ( $text === '' || ! self::matches_focus( $text, $focus ) ) {
				continue;
			}
			$m = isset( $row['metrics'] ) && is_array( $row['metrics'] ) ? $row['metrics'] : array();
			$out[] = array(
				'text'   => $text,
				'source' => 'ads_account',
				'clicks' => (int) ( $m['clicks'] ?? 0 ),
			);
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $results
	 * @return array<int,array<string,mixed>>
	 */
	private static function map_ads_search_terms( array $results, string $focus, int $limit ): array {
		$out = array();
		foreach ( $results as $row ) {
			$view = isset( $row['searchTermView'] ) && is_array( $row['searchTermView'] ) ? $row['searchTermView'] : array();
			$text = trim( (string) ( $view['searchTerm'] ?? '' ) );
			if ( $text === '' || ! self::matches_focus( $text, $focus ) ) {
				continue;
			}
			$m = isset( $row['metrics'] ) && is_array( $row['metrics'] ) ? $row['metrics'] : array();
			$out[] = array(
				'text'   => $text,
				'source' => 'ads_account',
				'clicks' => (int) ( $m['clicks'] ?? 0 ),
			);
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @return array{ok:bool,statusCode?:int,error?:string,dfsKeywordIdeas?:array<int,array<string,mixed>>,dfsGoogleAdsKeywords?:array<int,array<string,mixed>>,serpPaidAds?:array<int,array<string,mixed>>}
	 */
	private static function fetch_dfs_signals( string $focus, string $location_name, string $language_code ): array {
		$ideas = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_dataforseo_labs_google_keyword_ideas',
			array(
				'keywords'       => array( $focus ),
				'location_name'  => $location_name,
				'language_code'  => $language_code,
				'limit'          => 30,
			)
		);
		if ( is_wp_error( $ideas ) ) {
			return array( 'ok' => false, 'statusCode' => 502, 'error' => $ideas->get_error_message() );
		}

		$related = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_dataforseo_labs_google_related_keywords',
			array(
				'keyword'        => $focus,
				'location_name'  => $location_name,
				'language_code'  => $language_code,
				'limit'          => 2,
			)
		);
		if ( is_wp_error( $related ) ) {
			return array( 'ok' => false, 'statusCode' => 502, 'error' => $related->get_error_message() );
		}

		$planner = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_kw_data_google_ads_keywords_for_keywords',
			array(
				'keywords'       => array( $focus ),
				'location_name'  => $location_name,
				'language_code'  => $language_code,
			)
		);
		if ( is_wp_error( $planner ) ) {
			return array( 'ok' => false, 'statusCode' => 502, 'error' => $planner->get_error_message() );
		}

		$serp = Neo_Pulse_App_Dataforseo_Mcp_Router::dispatch(
			'DataForSEO_serp_organic_live_advanced',
			array(
				'keyword'        => $focus,
				'location_name'  => $location_name,
				'language_code'  => $language_code,
				'depth'          => 10,
			)
		);
		if ( is_wp_error( $serp ) ) {
			return array( 'ok' => false, 'statusCode' => 502, 'error' => $serp->get_error_message() );
		}

		$idea_rows = self::parse_dfs_keyword_items( $ideas, 'dfs_labs', 30 );
		$related_rows = self::parse_dfs_keyword_items( $related, 'dfs_labs', 30 );
		$planner_rows = self::parse_dfs_planner_items( $planner, 30 );

		return array(
			'ok'                   => true,
			'dfsKeywordIdeas'      => self::dedupe_signal_rows( array_merge( $idea_rows, $related_rows ), 30 ),
			'dfsGoogleAdsKeywords' => self::dedupe_signal_rows( $planner_rows, 30 ),
			'serpPaidAds'          => self::parse_serp_paid_ads( $serp, 10 ),
		);
	}

	/**
	 * @param array<string,mixed> $dfs_result
	 * @return array<int,array<string,mixed>>
	 */
	private static function parse_dfs_keyword_items( array $dfs_result, string $source, int $limit ): array {
		$out = array();
		$tasks = isset( $dfs_result['tasks'] ) && is_array( $dfs_result['tasks'] ) ? $dfs_result['tasks'] : array();
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$results = isset( $task['result'] ) && is_array( $task['result'] ) ? $task['result'] : array();
			foreach ( $results as $result ) {
				if ( ! is_array( $result ) ) {
					continue;
				}
				$items = isset( $result['items'] ) && is_array( $result['items'] ) ? $result['items'] : array();
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$text = trim( (string) ( $item['keyword'] ?? $item['keyword_data']['keyword'] ?? '' ) );
					if ( $text === '' ) {
						continue;
					}
					$row = array(
						'text'   => $text,
						'source' => $source,
					);
					if ( isset( $item['keyword_info']['search_volume'] ) ) {
						$row['volume'] = (int) $item['keyword_info']['search_volume'];
					} elseif ( isset( $item['search_volume'] ) ) {
						$row['volume'] = (int) $item['search_volume'];
					}
					if ( isset( $item['keyword_info']['cpc'] ) ) {
						$row['cpc'] = (float) $item['keyword_info']['cpc'];
					}
					$out[] = $row;
					if ( count( $out ) >= $limit ) {
						return $out;
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $dfs_result
	 * @return array<int,array<string,mixed>>
	 */
	private static function parse_dfs_planner_items( array $dfs_result, int $limit ): array {
		$out = array();
		$tasks = isset( $dfs_result['tasks'] ) && is_array( $dfs_result['tasks'] ) ? $dfs_result['tasks'] : array();
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$results = isset( $task['result'] ) && is_array( $task['result'] ) ? $task['result'] : array();
			foreach ( $results as $result ) {
				if ( ! is_array( $result ) ) {
					continue;
				}
				$items = isset( $result['items'] ) && is_array( $result['items'] ) ? $result['items'] : array();
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$text = trim( (string) ( $item['keyword'] ?? '' ) );
					if ( $text === '' ) {
						continue;
					}
					$row = array(
						'text'   => $text,
						'source' => 'dfs_google_ads',
					);
					if ( isset( $item['search_volume'] ) ) {
						$row['volume'] = (int) $item['search_volume'];
					}
					if ( isset( $item['cpc'] ) ) {
						$row['cpc'] = (float) $item['cpc'];
					}
					$out[] = $row;
					if ( count( $out ) >= $limit ) {
						return $out;
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @param array<string,mixed> $serp_result
	 * @return array<int,array<string,mixed>>
	 */
	private static function parse_serp_paid_ads( array $serp_result, int $limit ): array {
		$out = array();
		$tasks = isset( $serp_result['tasks'] ) && is_array( $serp_result['tasks'] ) ? $serp_result['tasks'] : array();
		foreach ( $tasks as $task ) {
			if ( ! is_array( $task ) ) {
				continue;
			}
			$results = isset( $task['result'] ) && is_array( $task['result'] ) ? $task['result'] : array();
			foreach ( $results as $result ) {
				if ( ! is_array( $result ) ) {
					continue;
				}
				$items = isset( $result['items'] ) && is_array( $result['items'] ) ? $result['items'] : array();
				foreach ( $items as $item ) {
					if ( ! is_array( $item ) ) {
						continue;
					}
					$type = strtolower( (string) ( $item['type'] ?? '' ) );
					if ( $type !== 'paid' && $type !== 'ads' && $type !== 'paid_block' ) {
						continue;
					}
					$title = trim( (string) ( $item['title'] ?? '' ) );
					$desc  = trim( (string) ( $item['description'] ?? '' ) );
					$url   = trim( (string) ( $item['url'] ?? $item['domain'] ?? '' ) );
					if ( $title === '' && $desc === '' ) {
						continue;
					}
					$out[] = array(
						'text'        => $title !== '' ? $title : $desc,
						'source'      => 'serp_paid',
						'title'       => $title,
						'description' => $desc,
						'url'         => $url,
					);
					if ( count( $out ) >= $limit ) {
						return $out;
					}
				}
			}
		}
		return $out;
	}

	/**
	 * @param array<int,array<string,mixed>> $rows
	 * @return array<int,array<string,mixed>>
	 */
	private static function dedupe_signal_rows( array $rows, int $limit ): array {
		$seen = array();
		$out  = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = trim( (string) ( $row['text'] ?? '' ) );
			if ( $text === '' ) {
				continue;
			}
			$key = strtolower( $text );
			if ( isset( $seen[ $key ] ) ) {
				continue;
			}
			$seen[ $key ] = true;
			$out[]        = $row;
			if ( count( $out ) >= $limit ) {
				break;
			}
		}
		return $out;
	}

	private static function matches_focus( string $text, string $focus ): bool {
		$text_lower  = strtolower( $text );
		$focus_lower = strtolower( trim( $focus ) );
		if ( $focus_lower === '' ) {
			return true;
		}
		if ( str_contains( $text_lower, $focus_lower ) ) {
			return true;
		}
		foreach ( preg_split( '/\s+/', $focus_lower ) as $part ) {
			$part = trim( $part );
			if ( $part !== '' && strlen( $part ) >= 3 && str_contains( $text_lower, $part ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * @param mixed $raw
	 * @return array<int,array<string,mixed>>
	 */
	private static function normalize_gsc_queries( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$out = array();
		foreach ( $raw as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$text = trim( (string) ( $row['text'] ?? $row['query'] ?? '' ) );
			if ( $text === '' ) {
				continue;
			}
			$out[] = array(
				'text'        => $text,
				'source'      => 'gsc',
				'clicks'      => isset( $row['clicks'] ) ? (int) $row['clicks'] : null,
				'impressions' => isset( $row['impressions'] ) ? (int) $row['impressions'] : null,
			);
			if ( count( $out ) >= 30 ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * @param mixed $raw
	 * @return string[]
	 */
	private static function string_list( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$out = array();
		foreach ( $raw as $item ) {
			$s = trim( (string) $item );
			if ( $s !== '' ) {
				$out[] = $s;
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
			'error'      => $message,
			'statusCode' => $status,
		);
	}
}
