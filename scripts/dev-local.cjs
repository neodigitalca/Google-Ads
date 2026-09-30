#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const { requireLocalDevApiTarget } = require("./resolve-dev-api-target.cjs");

const repoRoot = path.resolve(__dirname, "..");
const viteBin = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");

process.env.VITE_LOCAL_API_TARGET = requireLocalDevApiTarget();
process.env.VITE_MCP_API_BASE = process.env.VITE_MCP_API_BASE || "/api/mcp";

const viteArgs = [viteBin];
if (process.env.LOCAL_DEV_VITE_FORCE === "1") {
  viteArgs.push("--force");
}

const result = spawnSync(process.execPath, viteArgs, {
  stdio: "inherit",
  cwd: repoRoot,
  env: process.env,
});

process.exit(result.status ?? 1);
