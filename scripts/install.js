#!/usr/bin/env node
// Unblind — Node.js 安装脚本
// 将仓库内容部署到 Claude Code 技能目录

import { cpSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");  // scripts/install.js → repo root
const HOME = homedir();

const SKILL_DIR = join(HOME, ".claude", "skills", "unblind");
const AGENTS_DIR = join(HOME, ".agents", "skills", "unblind");
const SETTINGS_FILE = join(HOME, ".claude", "settings.json");

const FILES_TO_COPY = [
  "SKILL.md",
  "README.md",
];

const DIRS_TO_COPY = [
  "scripts",
  "templates",
  "resources",
];

function checkNodeVersion() {
  const version = process.version.slice(1).split(".").map(Number);
  if (version[0] < 18) {
    console.error(`Error: Node.js >= 18 required. Current: ${process.version}`);
    process.exit(1);
  }
}

function deploy(targetDir) {
  mkdirSync(targetDir, { recursive: true });
  console.log(`→ Deploying to ${targetDir}...`);

  for (const file of FILES_TO_COPY) {
    const src = join(REPO_ROOT, file);
    const dest = join(targetDir, file);
    if (existsSync(src)) {
      cpSync(src, dest);
      console.log(`  ✓ ${file}`);
    }
  }

  for (const dir of DIRS_TO_COPY) {
    const src = join(REPO_ROOT, dir);
    const dest = join(targetDir, dir);
    if (existsSync(src)) {
      cpSync(src, dest, { recursive: true });
      console.log(`  ✓ ${dir}/`);
    }
  }
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--check")) {
    // 仅检查，不部署
    console.log("Unblind Installation Check");
    console.log("==========================");
    console.log(`Node.js: ${process.version} ${process.version.slice(1).split(".")[0] >= 18 ? "✓" : "✗"}`);
    console.log(`SKILL.md: ${existsSync(SKILL_DIR + "/SKILL.md") ? "✓" : "✗"}`);
    console.log(`unblind.mjs: ${existsSync(SKILL_DIR + "/scripts/unblind.mjs") ? "✓" : "✗"}`);
    console.log(`settings.json: ${existsSync(SETTINGS_FILE) ? "✓" : "✗"}`);
    if (existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(readFileSync(SETTINGS_FILE, "utf8"));
      console.log(`MIMO_API_KEY: ${settings.env?.MIMO_API_KEY ? `✓ (${settings.env.MIMO_API_KEY.slice(0, 3)}...)` : "✗"}`);
      console.log(`MIMO_VISION_MODEL: ${settings.env?.MIMO_VISION_MODEL || "✗"}`);
    }
    return;
  }

  console.log("📸 Unblind — Installation Script");
  console.log("==================================\n");

  checkNodeVersion();
  deploy(SKILL_DIR);
  deploy(AGENTS_DIR);

  console.log(`\n✅ Unblind installed successfully!`);
  console.log(`\nSend any image to Claude Code to start using it.`);
  console.log(`First run will auto-configure your Mimo API Key.\n`);
}

main();
