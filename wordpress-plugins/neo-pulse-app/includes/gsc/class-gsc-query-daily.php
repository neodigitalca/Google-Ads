<?php
/**
 * GSC daily Search Analytics for filtered queries (reporting sparklines).
 *
 * @package Neo_Pulse_App
 */

defined( 'ABSPATH' ) || exit;

class Neo_Pulse_App_Gsc_Query_Daily {

	const MAX_QUERIES = 3;

	/** @param array<string,mixed> $body */
	public static function query_daily_series( array $body ): array {
		$site_url = trim( (string) ( $body['siteUrl'] ?? '' ) );
		if ( $site_url === '' ) {
			return self::err( 400, 'Missing required field: siteUrl' );
		}
		if ( empty( $body['startDate'] ) || empty( $body['endDate'] ) ) {
			return self::err( 400, 'startDate and endDate required' );
		}
		$dv = Neo_Pulse_App_Gsc_Service_Account::validate_dates( $body['startDate'], $body['endDate'] );
		if ( empty( $dv['valid'] ) ) {
			return self::err( 400, $dv['error'] ?? 'Invalid date range' );
		}
		$queries = isset( $body['queries'] ) && is_array( $body['queries'] ) ? $body['queries'] : array();
		$queries = array_values(
			array_filter(
				array_map(
					static function ( $q ) {
						return is_string( $q ) ? trim( $q ) : '';
					},
					$queries
				)
			)
		);
		if ( empty( $queries ) ) {
			return self::err( 400, 'queries array is required' );
		}
		if ( count( $queries ) > self::MAX_QUERIES ) {
			$queries = array_slice( $queries, 0, self::MAX_QUERIES );
		}

		$resolved = Neo_Pulse_App_Gsc_Service_Account::resolve_or_fallback(
			$site_url,
			$dv['startDateStr'],
			$dv['endDateStr'],
			'query'
		);
		if ( ! $resolved['property'] ) {
			$email = Neo_Pulse_App_Gsc_Service_Account::service_account_email();
			return self::err(
				200,
				"Add {$email} in GSC for this property.",
				array(
					'success' => false,
					'errorType' => 'site_not_in_list',
				)
			);
		}
		$prop = $resolved['property'];

		$series = array();
		foreach ( $queries as $query ) {
			$res = Neo_Pulse_App_Gsc_Service_Account::search_analytics_query(
				$prop,
				array(
					'startDate'  => $dv['startDateStr'],
					'endDate'    => $dv['endDateStr'],
					'dimensions' => array( 'date' ),
					'rowLimit'   => 25000,
					'dimensionFilterGroups' => array(
						array(
							'filters' => array(
								array(
									'dimension'  => 'query',
									'operator'   => 'equals',
									'expression' => $query,
								),
							),
						),
					),
				)
			);
			if ( is_wp_error( $res ) ) {
				return self::err( 500, $res->get_error_message() ?: 'GSC query daily series failed' );
			}
			$days = array();
			foreach ( ( $res['rows'] ?? array() ) as $row ) {
				$date = (string) ( $row['keys'][0] ?? '' );
				if ( $date === '' ) {
					continue;
				}
				$days[] = array(
					'date'        => $date,
					'clicks'      => (int) ( $row['clicks'] ?? 0 ),
					'impressions' => (int) ( $row['impressions'] ?? 0 ),
					'position'    => (float) ( $row['position'] ?? 0 ),
				);
			}
			usort(
				$days,
				static function ( $a, $b ) {
					return strcmp( $a['date'], $b['date'] );
				}
			);
			$series[] = array(
				'query' => $query,
				'days'  => $days,
			);
		}

		return array(
			'statusCode' => 200,
			'body'       => array(
				'success' => true,
				'property' => $prop,
				'startDate' => $dv['startDateStr'],
				'endDate' => $dv['endDateStr'],
				'series'  => $series,
			),
		);
	}

	/**
	 * @param array<string,mixed> $extra
	 * @return array{statusCode:int,body:array<string,mixed>}
	 */
	private static function err( int $code, string $message, array $extra = array() ): array {
		return array(
			'statusCode' => $code,
			'body'       => array_merge(
				array(
					'success' => false,
					'error'   => $message,
				),
				$extra
			),
		);
	}
}
