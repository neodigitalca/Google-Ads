import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import SftpClient from "ssh2-sftp-client";

const ALGOS = {
  serverHostKey: ["ssh-rsa", "rsa-sha2-512", "rsa-sha2-256", "ecdsa-sha2-nistp256", "ssh-ed25519"],
  kex: [
    "curve25519-sha256",
    "ecdh-sha2-nistp256",
    "diffie-hellman-group14-sha256",
    "diffie-hellman-group-exchange-sha256",
    "diffie-hellman-group14-sha1",
  ],
};

function blindswestRow() {
  const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "wpengine-sftp-catalog.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  const site = catalog.rows.find((r) => r.site === "blindswest.ca" && !r.isStaging);
  if (!site) throw new Error("No blindswest.ca production catalog row");
  return site;
}

const PHP_INNER = `
$q = new WP_Query([
  'post_type' => 'service-area',
  'post_status' => ['publish','future','draft','pending','private'],
  'posts_per_page' => -1,
  'orderby' => 'date',
  'order' => 'DESC',
]);
$rows = [];
while ($q->have_posts()) {
  $q->the_post();
  $id = get_the_ID();
  $rows[] = [
    'id' => (int) $id,
    'status' => get_post_status($id),
    'date' => get_post_field('post_date', $id),
    'slug' => get_post_field('post_name', $id),
  ];
}
wp_reset_postdata();
$byMonth = [];
foreach ($rows as $r) {
  $m = substr($r['date'], 0, 7);
  $byMonth[$m] = ($byMonth[$m] ?? 0) + 1;
}
echo wp_json_encode([
  'total' => count($rows),
  'byStatus' => array_count_values(array_column($rows, 'status')),
  'byMonth' => $byMonth,
  'future' => array_values(array_filter($rows, fn($r) => $r['status'] === 'future')),
  'draft' => array_values(array_filter($rows, fn($r) => $r['status'] === 'draft')),
], JSON_UNESCAPED_SLASHES);
`;

async function runPhp(inner, remoteBase) {
  const site = blindswestRow();
  const token = randomBytes(16).toString("hex");
  const php = `<?php
if ( ( $_GET['key'] ?? '' ) !== '${token}' ) { http_response_code(403); exit('forbidden'); }
header('Content-Type: application/json; charset=utf-8');
$dir = __DIR__;
$wp_load = '';
for ( $i = 0; $i < 8; $i++ ) {
  if ( is_readable( $dir . '/wp-load.php' ) ) { $wp_load = $dir . '/wp-load.php'; break; }
  $dir = dirname( $dir );
}
if ( $wp_load === '' ) { http_response_code(500); echo '{"error":"wp-load missing"}'; exit; }
require_once $wp_load;
${inner}
@unlink( __FILE__ );
`;
  const tmpDir = join(dirname(fileURLToPath(import.meta.url)), "blindswest-flush");
  mkdirSync(tmpDir, { recursive: true });
  const localPhp = join(tmpDir, `${remoteBase}.php`);
  writeFileSync(localPhp, php, "utf8");
  const remote = `./wp-content/plugins/neo-pulse-wp/${remoteBase}.php`;
  const sftp = new SftpClient();
  await sftp.connect({
    host: site.host,
    port: site.port,
    username: site.username,
    password: site.password,
    readyTimeout: 45000,
    algorithms: ALGOS,
  });
  await sftp.put(localPhp, remote);
  await sftp.end();
  unlinkSync(localPhp);
  const url = `https://blindswest.ca/wp-content/plugins/neo-pulse-wp/${remoteBase}.php?key=${token}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

const data = await runPhp(PHP_INNER, `np-audit-sa-${Date.now()}`);
console.log(JSON.stringify(data, null, 2));
