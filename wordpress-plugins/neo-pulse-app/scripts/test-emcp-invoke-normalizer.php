<?php
/**
 * Smoke test: hub EMCP invoke normalizer (run from plugin root).
 *
 *   php scripts/test-emcp-invoke-normalizer.php
 */

require_once __DIR__ . '/../includes/internal/class-hub-internal-emcp-invoke-normalizer.php';

$resolve = static function ( string $slug ): int {
	return $slug === 'hunter-douglas-top-down-bottom-up-shades-canada' ? 21030 : 0;
};

$out = Neo_Pulse_App_Hub_Internal_Emcp_Invoke_Normalizer::normalize(
	'emcp-tools-update-post',
	array(
		'post_id'          => 'hunter-douglas-top-down-bottom-up-shades-canada',
		'meta_description' => 'Edmonton test. Edmonton again.',
	),
	$resolve
);

if ( $out['tool'] !== 'emcp-tools-rankmath-write' ) {
	fwrite( STDERR, "expected rankmath-write tool\n" );
	exit( 1 );
}
$inner = $out['arguments']['arguments'] ?? null;
if ( ! is_array( $inner ) || (int) ( $inner['post_id'] ?? 0 ) !== 21030 ) {
	fwrite( STDERR, "expected post_id 21030\n" );
	exit( 1 );
}
if ( trim( (string) ( $inner['description'] ?? '' ) ) === '' ) {
	fwrite( STDERR, "expected description\n" );
	exit( 1 );
}

echo "ok\n";
