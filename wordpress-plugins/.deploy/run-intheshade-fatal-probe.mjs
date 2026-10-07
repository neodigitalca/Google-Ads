/**
 * Upload and run fatal probe on intheshadeflorida.com.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";

const catalog = JSON.parse(
  readFileSync(join(import.meta.dirname, "wpengine-sftp-catalog.json"), "utf8"),
);
let site = catalog.rows.find(
  (r) => r.site === "intheshadeflorida.com" && r.username === "intheshade-neopulse" && !r.isStaging,
);
if (!site) {
  site = {
    site: "intheshadeflorida.com",
    host: "intheshade.sftp.wpengine.com",
    port: 2222,
    username: "intheshade-neopulse",
    password: "NEOPulse2026!",
  };
}

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

const token = randomBytes(16).toString("hex");
const outDir = join(import.meta.dirname, "intheshadeflorida-pull");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "probe-token.txt"), token, "utf8");

const php = readFileSync(join(import.meta.dirname, "nd-fatal-probe-once.php"), "utf8").replace(
  "ND_PROBE_TOKEN",
  token,
);

const sftp = new SftpClient();
await sftp.connect({
  host: site.host,
  port: site.port,
  username: site.username,
  password: site.password,
  readyTimeout: 60000,
  algorithms: ALGOS,
});

const remote = "./wp-content/plugins/its-fatal-probe-once.php";
await sftp.put(Buffer.from(php, "utf8"), remote);
await sftp.end();

const url = `https://intheshadeflorida.com/wp-content/plugins/its-fatal-probe-once.php?key=${token}`;
const res = await fetch(url);
const body = await res.text();
console.log("status", res.status);
console.log(body);
