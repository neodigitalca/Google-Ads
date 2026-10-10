/**
 * Upload email-desk hub PHP (EMCP invoke + contract) to neodigital neo-pulse-app plugin tree.
 *
 *   node wordpress-plugins/.deploy/deploy-neodigital-email-desk-hub.mjs
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(__dirname, "wpengine-sftp-catalog.json"), "utf8"));
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
const root = join(__dirname, "..", "neo-pulse-app");
const files = [
  "includes/internal/class-emcp-http-client.php",
  "includes/internal/class-email-desk-cloud-agent-contract.php",
  "includes/internal/class-hub-internal-emcp-invoke-normalizer.php",
  "includes/internal/class-hub-internal-emcp-route-handlers.php",
  "includes/internal/class-hub-internal-email-desk-route-handlers.php",
  "includes/internal/class-email-desk-post-completion.php",
  "includes/class-neo-pulse-app-loader.php",
  "includes/router/class-api-dispatcher.php",
];

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
const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 60000,
  algorithms: ALGOS,
});

let remoteBase = "./wp-content/plugins/neo-pulse-app";
if (!(await sftp.exists(remoteBase))) {
  const off = "./wp-content/plugins/neo-pulse-app.off";
  if (await sftp.exists(off)) {
    remoteBase = off;
    console.log("using", remoteBase);
  } else {
    console.error("neo-pulse-app not found on server");
    process.exit(1);
  }
}

for (const rel of files) {
  const remote = `${remoteBase}/${rel}`;
  const local = join(root, rel);
  await sftp.put(local, remote);
  console.log("put", rel);
}
await sftp.end();
console.log("email-desk hub PHP uploaded");
