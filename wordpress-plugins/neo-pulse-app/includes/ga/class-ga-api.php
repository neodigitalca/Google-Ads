<?php
/**
 * Google Analytics 4 Admin/Data API calls.
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Ga_Api {

	const SCOPE_READONLY = 'https://www.googleapis.com/auth/analytics.readonly';
	const TOKEN_URL      = 'https://oauth2.googleapis.com/token';
	const ADMIN_BASE     = 'https://analyticsadmin.googleapis.com/v1beta';
	const DATA_BASE      = 'https://analyticsdata.googleapis.com/v1beta';

	/**
	 * @param array<string,mixed> $body
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	public static function report_data( array $body ): array {
		$property_id = isset( $body['propertyId'] ) ? trim( (string) $body['propertyId'] ) : '';
		if ( $property_id === '' ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => 'Missing or invalid propertyId' ),
			);
		}
		foreach ( array( 'startDate', 'endDate', 'compareStartDate', 'compareEndDate' ) as $field ) {
			if ( empty( $body[ $field ] ) ) {
				return array(
					'statusCode' => 400,
					'body'       => array(
						'success' => false,
						'error'   => 'Missing date fields: startDate, endDate, compareStartDate, compareEndDate',
					),
				);
			}
		}

		$resolved = Neo_Pulse_App_Ga_Credentials::resolve_from_body( $body );
		if ( ! empty( $resolved['error'] ) ) {
			return array(
				'statusCode' => (int) ( $resolved['status'] ?? 503 ),
				'body'       => array( 'success' => false, 'error' => $resolved['error'] ),
			);
		}

		$credentials = $resolved['credentials'];
		$prop_id     = self::normalize_property_id( $property_id );
		if ( is_wp_error( $prop_id ) ) {
			return array(
				'statusCode' => 400,
				'body'       => array( 'success' => false, 'error' => $prop_id->get_error_message() ),
			);
		}

		$probe = self::run_report(
			$credentials,
			$prop_id,
			array(
				'dateRanges' => array( array( 'startDate' => 'yesterday', 'endDate' => 'yesterday' ) ),
				'metrics'    => array( array( 'name' => 'activeUsers' ) ),
			)
		);
		if ( is_wp_error( $probe ) ) {
			return array(
				'statusCode' => self::map_error_status( $probe ),
				'body'       => self::error_body_for_report( $probe, $credentials, $prop_id ),
			);
		}

		$result = array( 'success' => true, 'propertyId' => $prop_id );
		$filter      = array(
			'filter' => array(
				'fieldName'    => 'sessionDefaultChannelGroup',
				'stringFilter' => array( 'matchType' => 'EXACT', 'value' => 'Organic Search' ),
			),
		);
		$current     = array( 'startDate' => (string) $body['startDate'], 'endDate' => (string) $body['endDate'] );
		$compare     = array(
			'startDate' => (string) $body['compareStartDate'],
			'endDate'   => (string) $body['compareEndDate'],
		);
		$base        = array(
			'dimensions'      => array( array( 'name' => 'sessionDefaultChannelGroup' ) ),
			'dimensionFilter' => $filter,
		);

		self::merge_period_metric( $result, 'conversions', $credentials, $prop_id, $base, $current, $compare, 'conversions' );
		self::merge_period_metric( $result, 'organicTraffic', $credentials, $prop_id, $base, $current, $compare, 'sessions', true );

		$oa_current  = self::fetch_organic_acquisition_period( $credentials, $prop_id, $base, $current );
		$oa_previous = self::fetch_organic_acquisition_period( $credentials, $prop_id, $base, $compare );
		if ( is_wp_error( $oa_current ) ) {
			return array(
				'statusCode' => self::map_error_status( $oa_current ),
				'body'       => self::error_body_for_report( $oa_current, $credentials, $prop_id ),
			);
		}
		if ( is_wp_error( $oa_previous ) ) {
			return array(
				'statusCode' => self::map_error_status( $oa_previous ),
				'body'       => self::error_body_for_report( $oa_previous, $credentials, $prop_id ),
			);
		}
		if ( is_array( $oa_current ) && is_array( $oa_previous ) ) {
			$organic_acquisition = array(
				'current'  => $oa_current,
				'previous' => $oa_previous,
			);
			$result['organicAcquisition']         = $organic_acquisition;
			$result['organicTrafficAcquisition'] = $organic_acquisition;
		} else {
			return array(
				'statusCode' => 502,
				'body'       => array(
					'success'      => false,
					'error'        => 'GA4 organic acquisition metrics missing for this property and date range.',
					'propertyId'   => $prop_id,
					'client_email' => $credentials['client_email'] ?? '',
				),
			);
		}

		$include_acquisition_monthly = ! empty( $body['includeOrganicTrafficAcquisitionMonthly'] )
			|| ! empty( $body['includeOrganicUsersMonthly'] );
		if ( $include_acquisition_monthly ) {
			$monthly = self::fetch_organic_search_traffic_acquisition_monthly(
				$credentials,
				$prop_id,
				$base,
				$current
			);
			if ( is_wp_error( $monthly ) ) {
				return array(
					'statusCode' => self::map_error_status( $monthly ),
					'body'       => self::error_body_for_report( $monthly, $credentials, $prop_id ),
				);
			}
			if ( is_array( $monthly ) ) {
				$result['organicTrafficAcquisitionMonthly'] = $monthly;
			}
		}

		return array( 'statusCode' => 200, 'body' => $result );
	}

	/**
	 * GA4 User acquisition style block: first user medium = organic, by calendar month.
	 *
	 * @param array<string,string> $credentials
	 * @param array<string,string> $date_range startDate/endDate (YYYY-MM-DD)
	 * @return array<string,mixed>|WP_Error
	 */
	private static function fetch_organic_first_user_medium_users_monthly(
		array $credentials,
		string $prop_id,
		array $date_range
	) {
		$filter = array(
			'filter' => array(
				'fieldName'    => 'firstUserMedium',
				'stringFilter' => array(
					'matchType' => 'EXACT',
					'value'     => 'organic',
				),
			),
		);
		$metrics = array(
			array( 'name' => 'totalUsers' ),
			array( 'name' => 'newUsers' ),
			array( 'name' => 'userKeyEventRate' ),
			array( 'name' => 'keyEvents' ),
		);

		$monthly_report = self::run_report(
			$credentials,
			$prop_id,
			array(
				'dateRanges'      => array( $date_range ),
				'dimensions'      => array( array( 'name' => 'yearMonth' ) ),
				'dimensionFilter' => $filter,
				'metrics'         => $metrics,
				'orderBys'        => array(
					array(
						'dimension' => array( 'dimensionName' => 'yearMonth' ),
					),
				),
			)
		);
		if ( is_wp_error( $monthly_report ) ) {
			return $monthly_report;
		}

		$totals_report = self::run_report(
			$credentials,
			$prop_id,
			array(
				'dateRanges'      => array( $date_range ),
				'dimensionFilter' => $filter,
				'metrics'         => $metrics,
			)
		);
		if ( is_wp_error( $totals_report ) ) {
			return $totals_report;
		}

		$months_raw = self::parse_ga_dimension_metric_rows( $monthly_report, 'yearMonth' );
		$totals_raw = self::parse_ga_dimension_metric_rows( $totals_report, null );
		$months     = array();
		foreach ( $months_raw as $row ) {
			$months[] = array_merge(
				array(
					'yearMonth' => $row['key'],
					'label'     => $row['label'],
				),
				$row['metrics']
			);
		}
		$totals = ! empty( $totals_raw ) ? $totals_raw[0]['metrics'] : array();

		return array(
			'medium'      => 'organic',
			'dimension'   => 'firstUserMedium',
			'periodStart' => (string) $date_range['startDate'],
			'periodEnd'   => (string) $date_range['endDate'],
			'totals'      => $totals,
			'months'      => $months,
		);
	}

	/**
	 * GA4 Traffic acquisition: sessionDefaultChannelGroup = Organic Search, by calendar month.
	 *
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $base dimensions + dimensionFilter (Organic Search channel)
	 * @param array<string,string> $date_range
	 * @return array<string,mixed>|WP_Error
	 */
	private static function fetch_organic_search_traffic_acquisition_monthly(
		array $credentials,
		string $prop_id,
		array $base,
		array $date_range
	) {
		$metrics = array(
			array( 'name' => 'sessions' ),
			array( 'name' => 'engagedSessions' ),
			array( 'name' => 'engagementRate' ),
			array( 'name' => 'averageSessionDuration' ),
			array( 'name' => 'eventsPerSession' ),
			array( 'name' => 'eventCount' ),
			array( 'name' => 'keyEvents' ),
		);

		$monthly_report = self::run_report(
			$credentials,
			$prop_id,
			array_merge(
				$base,
				array(
					'dateRanges' => array( $date_range ),
					'dimensions' => array( array( 'name' => 'yearMonth' ) ),
					'metrics'    => $metrics,
					'orderBys'   => array(
						array(
							'dimension' => array( 'dimensionName' => 'yearMonth' ),
						),
					),
				)
			)
		);
		if ( is_wp_error( $monthly_report ) ) {
			return $monthly_report;
		}

		$totals_report = self::run_report(
			$credentials,
			$prop_id,
			array_merge(
				$base,
				array(
					'dateRanges' => array( $date_range ),
					'metrics'    => $metrics,
				)
			)
		);
		if ( is_wp_error( $totals_report ) ) {
			return $totals_report;
		}

		$months_raw = self::parse_ga_dimension_metric_rows( $monthly_report, 'yearMonth' );
		$totals_raw = self::parse_ga_dimension_metric_rows( $totals_report, null );
		$months     = array();
		foreach ( $months_raw as $row ) {
			$months[] = array_merge(
				array(
					'yearMonth' => $row['key'],
					'label'     => $row['label'],
				),
				self::normalize_organic_acquisition_metrics_row( $row['metrics'] )
			);
		}
		$totals = ! empty( $totals_raw )
			? self::normalize_organic_acquisition_metrics_row( $totals_raw[0]['metrics'] )
			: array();

		return array(
			'channel'     => 'Organic Search',
			'dimension'   => 'sessionDefaultChannelGroup',
			'periodStart' => (string) $date_range['startDate'],
			'periodEnd'   => (string) $date_range['endDate'],
			'totals'      => $totals,
			'months'      => $months,
		);
	}

	/**
	 * @param array<string,float|int> $metrics Raw GA metric names from parse_ga_dimension_metric_rows.
	 * @return array<string,float|int>
	 */
	private static function normalize_organic_acquisition_metrics_row( array $metrics ): array {
		$sessions = isset( $metrics['sessions'] ) ? (int) round( (float) $metrics['sessions'] ) : 0;
		$engaged  = isset( $metrics['engagedSessions'] ) ? (int) round( (float) $metrics['engagedSessions'] ) : 0;
		$rate     = isset( $metrics['engagementRate'] ) ? (float) $metrics['engagementRate'] : 0.0;
		$avg_sec  = isset( $metrics['averageSessionDuration'] )
			? (int) round( (float) $metrics['averageSessionDuration'] )
			: 0;
		$ev_sess  = isset( $metrics['eventsPerSession'] ) ? round( (float) $metrics['eventsPerSession'], 2 ) : 0.0;
		$events   = isset( $metrics['eventCount'] ) ? (int) round( (float) $metrics['eventCount'] ) : 0;
		$keys     = isset( $metrics['keyEvents'] ) ? (int) round( (float) $metrics['keyEvents'] ) : 0;
		return array(
			'sessions'                  => $sessions,
			'engagedSessions'           => $engaged,
			'engagementRate'            => $rate,
			'averageSessionDurationSec' => $avg_sec,
			'eventsPerSession'          => $ev_sess,
			'eventCount'                => $events,
			'keyEvents'                 => $keys,
		);
	}

	/**
	 * @param array<string,mixed> $response GA runReport body.
	 * @return array<int,array{key:string,label:string,metrics:array<string,float|int>}>
	 */
	private static function parse_ga_dimension_metric_rows( array $response, ?string $dimension_name ): array {
		$rows = isset( $response['rows'] ) && is_array( $response['rows'] ) ? $response['rows'] : array();
		if ( empty( $rows ) ) {
			return array();
		}
		$metric_headers = isset( $response['metricHeaders'] ) && is_array( $response['metricHeaders'] )
			? $response['metricHeaders']
			: array();
		$metric_names   = array();
		foreach ( $metric_headers as $header ) {
			if ( is_array( $header ) && ! empty( $header['name'] ) ) {
				$metric_names[] = (string) $header['name'];
			}
		}
		$out = array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$key = '';
			if ( $dimension_name !== null ) {
				$dim_values = isset( $row['dimensionValues'] ) && is_array( $row['dimensionValues'] )
					? $row['dimensionValues']
					: array();
				$key = isset( $dim_values[0]['value'] ) ? (string) $dim_values[0]['value'] : '';
			}
			$metric_values = isset( $row['metricValues'] ) && is_array( $row['metricValues'] )
				? $row['metricValues']
				: array();
			$metrics       = array();
			foreach ( $metric_names as $i => $name ) {
				if ( ! isset( $metric_values[ $i ]['value'] ) ) {
					continue;
				}
				$val = (float) $metric_values[ $i ]['value'];
				if ( in_array( $name, array( 'totalUsers', 'newUsers', 'keyEvents' ), true ) ) {
					$metrics[ $name ] = (int) round( $val );
				} else {
					$metrics[ $name ] = $val;
				}
			}
			$label = $key !== '' ? self::format_ga_year_month_label( $key ) : 'Period total';
			$out[] = array(
				'key'     => $key,
				'label'   => $label,
				'metrics' => $metrics,
			);
		}
		return $out;
	}

	private static function format_ga_year_month_label( string $year_month ): string {
		if ( ! preg_match( '/^(\d{4})(\d{2})$/', $year_month, $m ) ) {
			return $year_month;
		}
		$month = (int) $m[2];
		$year  = (int) $m[1];
		if ( $month < 1 || $month > 12 ) {
		 return $year_month;
		}
		$ts = gmmktime( 0, 0, 0, $month, 1, $year );
		return gmdate( 'F Y', $ts );
	}

	/**
	 * @return string|WP_Error Numeric GA4 property id.
	 */
	public static function normalize_property_id( string $raw ) {
		$id = trim( $raw );
		$id = preg_replace( '/^properties\/?/i', '', $id );
		if ( preg_match( '/^G-/i', $id ) ) {
			return new WP_Error(
				'neo-pulse_ga_property',
				'Use the numeric GA4 Property ID from Admin → Property settings, not the Measurement ID (G-…).'
			);
		}
		if ( ! preg_match( '/^\d+$/', $id ) ) {
			return new WP_Error( 'neo-pulse_ga_property', 'GA4 Property ID must be numeric digits only.' );
		}
		return $id;
	}

	/**
	 * @param array<string,string> $credentials
	 * @return array<string,mixed>
	 */
	private static function error_body_for_report( WP_Error $error, array $credentials, string $prop_id ): array {
		return array(
			'success'      => false,
			'error'        => self::format_api_error_for_user( $error, $credentials['client_email'] ?? '', $prop_id ),
			'propertyId'   => $prop_id,
			'client_email' => $credentials['client_email'] ?? '',
		);
	}

	public static function format_api_error_for_user_public( WP_Error $error, string $client_email, string $prop_id ): string {
		return self::format_api_error_for_user( $error, $client_email, $prop_id );
	}

	private static function format_api_error_for_user( WP_Error $error, string $client_email, string $prop_id ): string {
		$msg = $error->get_error_message();
		if ( $client_email === '' ) {
			return $msg;
		}
		if (
			stripos( $msg, 'sufficient permissions' ) !== false
			|| stripos( $msg, 'PERMISSION_DENIED' ) !== false
			|| stripos( $msg, 'permission' ) !== false
		) {
			return sprintf(
				'%s (Property ID %s). Neo Pulse calls GA4 with the service account %s, not your personal Google login. In GA4: Admin → Property access management → Add user → paste that email → role Viewer.',
				$msg,
				$prop_id,
				$client_email
			);
		}
		return $msg;
	}

	/**
	 * Organic Search metrics for one date range (single channel row expected).
	 *
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $base
	 * @param array<string,string> $date_range
	 * @return array<string,float|int>|null
	 */
	/**
	 * @return array<string,float|int>|WP_Error|null
	 */
	private static function fetch_organic_acquisition_period(
		array $credentials,
		string $prop_id,
		array $base,
		array $date_range
	) {
		$metrics = array(
			array( 'name' => 'sessions' ),
			array( 'name' => 'engagedSessions' ),
			array( 'name' => 'engagementRate' ),
			array( 'name' => 'averageSessionDuration' ),
			array( 'name' => 'eventsPerSession' ),
			array( 'name' => 'eventCount' ),
			array( 'name' => 'keyEvents' ),
		);
		$report = self::run_report(
			$credentials,
			$prop_id,
			array_merge(
				$base,
				array(
					'dateRanges' => array( $date_range ),
					'metrics'    => $metrics,
				)
			)
		);
		if ( is_wp_error( $report ) ) {
			return $report;
		}
		$parsed = self::parse_organic_acquisition_row( $report );
		if ( is_array( $parsed ) ) {
			return $parsed;
		}
		return array(
			'sessions'                  => 0,
			'engagedSessions'           => 0,
			'engagementRate'            => 0.0,
			'averageSessionDurationSec' => 0,
			'keyEvents'                 => 0,
			'eventCount'                => 0,
			'eventsPerSession'          => 0.0,
		);
	}

	/**
	 * @param array<string,mixed> $response
	 * @return array<string,float|int>|null
	 */
	private static function parse_organic_acquisition_row( array $response ): ?array {
		$rows = isset( $response['rows'] ) && is_array( $response['rows'] ) ? $response['rows'] : array();
		if ( empty( $rows ) || ! is_array( $rows[0] ) ) {
			return null;
		}
		$headers = isset( $response['metricHeaders'] ) && is_array( $response['metricHeaders'] )
			? $response['metricHeaders']
			: array();
		$values  = isset( $rows[0]['metricValues'] ) && is_array( $rows[0]['metricValues'] )
			? $rows[0]['metricValues']
			: array();
		$by_name = array();
		foreach ( $headers as $i => $header ) {
			if ( ! is_array( $header ) ) {
				continue;
			}
			$name = isset( $header['name'] ) ? (string) $header['name'] : '';
			if ( $name === '' || ! isset( $values[ $i ]['value'] ) ) {
				continue;
			}
			$by_name[ $name ] = (float) $values[ $i ]['value'];
		}
		$read = static function ( string $metric ) use ( $by_name ): float {
			return isset( $by_name[ $metric ] ) ? (float) $by_name[ $metric ] : 0.0;
		};
		return array(
			'sessions'                  => (int) round( $read( 'sessions' ) ),
			'engagedSessions'           => (int) round( $read( 'engagedSessions' ) ),
			'engagementRate'            => $read( 'engagementRate' ),
			'averageSessionDurationSec' => (int) round( $read( 'averageSessionDuration' ) ),
			'eventsPerSession'          => round( $read( 'eventsPerSession' ), 2 ),
			'eventCount'                => (int) round( $read( 'eventCount' ) ),
			'keyEvents'                 => (int) round( $read( 'keyEvents' ) ),
		);
	}

	/**
	 * @param array<string,string> $credentials
	 * @return array<string,mixed>|WP_Error
	 */
	public static function list_account_summaries( array $credentials ) {
		$token = self::get_access_token( $credentials );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$response = wp_remote_get(
			self::ADMIN_BASE . '/accountSummaries',
			array(
				'timeout' => 45,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Accept'        => 'application/json',
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : 'HTTP ' . $code );
			return new WP_Error( 'neo-pulse_ga_admin', $msg, array( 'status' => $code ) );
		}
		return is_array( $data ) ? $data : array();
	}

	/**
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $payload
	 * @return array<string,mixed>|WP_Error
	 */
	public static function run_report( array $credentials, string $property_id, array $payload ) {
		$token = self::get_access_token( $credentials );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$url      = self::DATA_BASE . '/properties/' . rawurlencode( $property_id ) . ':runReport';
		$response = wp_remote_post(
			$url,
			array(
				'timeout' => 60,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
					'Accept'        => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$raw  = wp_remote_retrieve_body( $response );
		$data = json_decode( $raw, true );
		if ( $code < 200 || $code >= 300 ) {
			$msg = is_array( $data ) && ! empty( $data['error']['message'] )
				? (string) $data['error']['message']
				: ( $raw !== '' ? $raw : 'HTTP ' . $code );
			return new WP_Error( 'neo-pulse_ga_report', $msg, array( 'status' => $code ) );
		}
		return is_array( $data ) ? $data : array();
	}

	public static function map_error_status( WP_Error $error ): int {
		$msg    = $error->get_error_message();
		$status = (int) ( $error->get_error_data()['status'] ?? 0 );
		if ( $status === 403 || stripos( $msg, 'PERMISSION_DENIED' ) !== false ) {
			return 403;
		}
		if ( $status === 404 || stripos( $msg, 'NOT_FOUND' ) !== false ) {
			return 404;
		}
		return 502;
	}

	/**
	 * @param array<string,mixed>  $result
	 * @param array<string,string> $credentials
	 * @param array<string,mixed>  $base
	 * @param array<string,string> $current
	 * @param array<string,string> $compare
	 */
	private static function merge_period_metric(
		array &$result,
		string $key,
		array $credentials,
		string $prop_id,
		array $base,
		array $current,
		array $compare,
		string $metric,
		bool $sessions_shape = false
	): void {
		$cur = self::run_report(
			$credentials,
			$prop_id,
			array_merge( $base, array( 'dateRanges' => array( $current ), 'metrics' => array( array( 'name' => $metric ) ) ) )
		);
		$prev = self::run_report(
			$credentials,
			$prop_id,
			array_merge( $base, array( 'dateRanges' => array( $compare ), 'metrics' => array( array( 'name' => $metric ) ) ) )
		);
		if ( is_wp_error( $cur ) || is_wp_error( $prev ) ) {
			return;
		}
		$current_total  = self::sum_metric_rows( $cur );
		$previous_total = self::sum_metric_rows( $prev );
		$change         = $current_total - $previous_total;
		if ( $sessions_shape ) {
			$result[ $key ] = array(
				'sessionsCurrent'  => $current_total,
				'sessionsPrevious' => $previous_total,
				'change'           => $change,
				'changePercent'    => $previous_total > 0 ? (int) round( ( $change / $previous_total ) * 100 ) : null,
			);
			return;
		}
		$result[ $key ] = array(
			'current'       => $current_total,
			'previous'      => $previous_total,
			'change'        => $change,
			'changePercent' => $previous_total > 0 ? (int) round( ( $change / $previous_total ) * 100 ) : null,
		);
	}

	/**
	 * @param array<string,mixed> $response
	 */
	private static function sum_metric_rows( array $response ): float {
		$total = 0.0;
		$rows  = isset( $response['rows'] ) && is_array( $response['rows'] ) ? $response['rows'] : array();
		foreach ( $rows as $row ) {
			if ( ! is_array( $row ) ) {
				continue;
			}
			$values = isset( $row['metricValues'] ) && is_array( $row['metricValues'] ) ? $row['metricValues'] : array();
			if ( ! empty( $values[0]['value'] ) ) {
				$total += (float) $values[0]['value'];
			}
		}
		return $total;
	}

	/**
	 * @param array<string,string> $credentials
	 * @return string|WP_Error
	 */
	private static function get_access_token( array $credentials ) {
		$scope     = self::SCOPE_READONLY;
		$cache_key = 'neo-pulse_app_ga_token_' . md5( $credentials['client_email'] . '|' . $scope );
		$cached    = get_transient( $cache_key );
		if ( is_string( $cached ) && $cached !== '' ) {
			return $cached;
		}
		$jwt = self::build_jwt( $credentials['client_email'], $credentials['private_key'], $scope );
		if ( is_wp_error( $jwt ) ) {
			return $jwt;
		}
		$response = wp_remote_post(
			self::TOKEN_URL,
			array(
				'timeout' => 30,
				'headers' => array( 'Content-Type' => 'application/x-www-form-urlencoded' ),
				'body'    => array(
					'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
					'assertion'  => $jwt,
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $code < 200 || $code >= 300 || ! is_array( $data ) || empty( $data['access_token'] ) ) {
			$msg = is_array( $data ) && ! empty( $data['error_description'] )
				? (string) $data['error_description']
				: 'Could not obtain GA access token.';
			return new WP_Error( 'neo-pulse_ga_token', $msg );
		}
		$token = (string) $data['access_token'];
		set_transient( $cache_key, $token, 3000 );
		return $token;
	}

	/**
	 * @return string|WP_Error
	 */
	private static function build_jwt( string $client_email, string $private_key, string $scope ) {
		$now    = time();
		$header = self::b64( wp_json_encode( array( 'alg' => 'RS256', 'typ' => 'JWT' ) ) );
		$claim  = self::b64(
			wp_json_encode(
				array(
					'iss'   => $client_email,
					'scope' => $scope,
					'aud'   => self::TOKEN_URL,
					'exp'   => $now + 3600,
					'iat'   => $now,
				)
			)
		);
		$input = $header . '.' . $claim;
		$key   = openssl_pkey_get_private( $private_key );
		if ( false === $key ) {
			return new WP_Error( 'neo-pulse_ga_key', 'Could not read GA service account private key.' );
		}
		$signature = '';
		$signed    = openssl_sign( $input, $signature, $key, OPENSSL_ALGO_SHA256 );
		if ( function_exists( 'openssl_free_key' ) ) {
			openssl_free_key( $key );
		}
		if ( ! $signed ) {
			return new WP_Error( 'neo-pulse_ga_sign', 'Could not sign GA JWT.' );
		}
		return $input . '.' . self::b64( $signature );
	}

	private static function b64( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' );
	}
}
