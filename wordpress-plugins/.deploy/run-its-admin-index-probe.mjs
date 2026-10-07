import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import SftpClient from "ssh2-sftp-client";

const site = {
  host: "intheshade.sftp.wpengine.com",
  port: 2222,
  username: "intheshade-neopulse",
  password: "NEOPulse2026!",
};

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
writeFileSync(join(outDir, "index-probe-token.txt"), token, "utf8");

const php = readFileSync(join(import.meta.dirname, "its-admin-index-probe-once.php"), "utf8").replace(
  "ITS_INDEX_PROBE_TOKEN",
  token,
);

const sftp = new SftpClient();
await sftp.connect({ ...site, readyTimeout: 60000, algorithms: ALGOS });
await sftp.put(Buffer.from(php, "utf8"), "./wp-content/plugins/its-admin-index-probe-once.php");
await sftp.end();

const url = `https://intheshadeflorida.com/wp-content/plugins/its-admin-index-probe-once.php?key=${token}`;
const res = await fetch(url);
const body = await res.text();
console.log("status", res.status);
console.log(body.slice(0, 3000));
