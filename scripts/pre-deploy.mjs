#!/usr/bin/env node

import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read package.json to get current version
const packageJsonPath = path.join(__dirname, "..", "package.json")
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"))
const version = packageJson.version

// Read wrangler.toml
const wranglerPath = path.join(__dirname, "..", "wrangler.toml")
let wranglerContent = fs.readFileSync(wranglerPath, "utf8")

// Update version in wrangler.toml
const versionRegex = /VERSION = "[^"]*"/
if (versionRegex.test(wranglerContent)) {
  wranglerContent = wranglerContent.replace(versionRegex, `VERSION = "${version}"`)
} else {
  // Add version if it doesn't exist
  wranglerContent = wranglerContent.replace(/(\[vars\])/, `$1\nVERSION = "${version}"`)
}

// Write updated wrangler.toml
fs.writeFileSync(wranglerPath, wranglerContent)

console.log(`✅ Updated wrangler.toml with version: ${version}`)
console.log(`🚀 Ready to deploy version ${version}`)
