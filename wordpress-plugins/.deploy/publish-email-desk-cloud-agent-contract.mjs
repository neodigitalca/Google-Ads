/**
 * Publish email-desk cloud agent contract JSON to neodigital.ca uploads (public read).
 *
 *   node wordpress-plugins/.deploy/publish-email-desk-cloud-agent-contract.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import SftpClient from "ssh2-sftp-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(__dirname, "wpengine-sftp-catalog.json"), "utf8"));
const site = catalog.rows.find((r) => r.site === "neodigital.ca" && !r.isStaging);
if (!site) {
  console.error("neodigital.ca not in catalog");
  process.exit(1);
}

const contractPath = join(__dirname, "..", "..", "public", "neo-pulse-data", "email-desk-cloud-agent-contract.json");
mkdirSync(dirname(contractPath), { recursive: true });

const repoRoot = join(__dirname, "..", "..");
const payloadJson = await new Promise((resolve, reject) => {
  import("node:child_process").then(({ execFile }) => {
    execFile(
      "npx",
      ["tsx", "-e", "import { emailDeskCloudAgentContractPayload } from './src/lib/email-desk/email-desk-cloud-agent-contract.ts'; process.stdout.write(JSON.stringify(emailDeskCloudAgentContractPayload()));"],
      { cwd: repoRoot, maxBuffer: 2 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout)),
    );
  });
});
writeFileSync(contractPath, `${JSON.stringify(JSON.parse(payloadJson), null, 2)}\n`, "utf8");

const remoteDir = "./wp-content/uploads/neo-pulse-data";
const remoteFile = `${remoteDir}/email-desk-cloud-agent-contract.json`;
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
if (!(await sftp.exists(remoteDir))) {
  await sftp.mkdir(remoteDir, true);
}
await sftp.put(contractPath, remoteFile);
await sftp.end();
console.log("published", "https://neodigital.ca/wp-content/uploads/neo-pulse-data/email-desk-cloud-agent-contract.json");
