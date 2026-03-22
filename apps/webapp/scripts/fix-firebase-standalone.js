#!/usr/bin/env node
/**
 * Restructure Next.js standalone output for Firebase App Hosting compatibility.
 *
 * With outputFileTracingRoot (monorepo), Next.js produces:
 *   .next/standalone/apps/webapp/server.js
 *   .next/standalone/apps/webapp/.next/routes-manifest.json
 *
 * Firebase adapter expects:
 *   .next/standalone/server.js
 *   .next/standalone/.next/routes-manifest.json
 *
 * This script copies the nested structure to the flat layout after next build.
 */

const fs = require("fs");
const path = require("path");

const standaloneDir = path.join(__dirname, "../.next/standalone");
const nestedApp = path.join(standaloneDir, "apps/webapp");

if (!fs.existsSync(nestedApp)) {
  // No nested structure (e.g. non-monorepo build) - nothing to fix
  process.exit(0);
}

const targetNext = path.join(standaloneDir, ".next");
const targetServer = path.join(standaloneDir, "server.js");
const sourceNext = path.join(nestedApp, ".next");
const sourceServer = path.join(nestedApp, "server.js");

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy .next (routes-manifest, etc.) for Firebase adapter
if (fs.existsSync(sourceNext)) {
  if (fs.existsSync(targetNext)) {
    fs.rmSync(targetNext, { recursive: true });
  }
  copyRecursive(sourceNext, targetNext);
}

// Copy server.js for runtime
if (fs.existsSync(sourceServer)) {
  fs.copyFileSync(sourceServer, targetServer);
}

console.log("Fixed standalone structure for Firebase App Hosting");
