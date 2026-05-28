import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, unlinkSync, existsSync, renameSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { loadConfig } from "../scripts/lib/config.js";

const SETTINGS_FILE = join(homedir(), ".claude", "settings.json");

function backupSettings() {
  if (existsSync(SETTINGS_FILE)) {
    const backup = SETTINGS_FILE + ".unblind-test-backup";
    if (existsSync(backup)) unlinkSync(backup);
    renameSync(SETTINGS_FILE, backup);
    return backup;
  }
  return null;
}

function restoreSettings(backup) {
  try { unlinkSync(SETTINGS_FILE); } catch {}
  if (backup && existsSync(backup)) {
    renameSync(backup, SETTINGS_FILE);
  }
}

function writeTestSettings(env = {}) {
  const dir = join(homedir(), ".claude");
  const content = JSON.stringify({ env }, null, 2);
  writeFileSync(SETTINGS_FILE, content, "utf8");
}

describe("config", () => {
  let backup;
  before(() => { backup = backupSettings(); });
  after(() => { restoreSettings(backup); });

  it("should return defaults when settings.json has no relevant fields", () => {
    writeTestSettings({});
    const cfg = loadConfig();
    assert.ok(cfg.maxImageSize > 0);
    assert.equal(cfg.retry.maxAttempts, 3);
    assert.equal(cfg.circuitBreaker.failureThreshold, 5);
    assert.equal(cfg.circuitBreaker.timeoutSeconds, 60);
    assert.equal(cfg.logging.level, "info");
  });

  it("should read user-set values", () => {
    writeTestSettings({
      MIMO_API_KEY: "tp-test123",
      MIMO_VISION_MODEL: "mimo-v2-omni",
    });
    const cfg = loadConfig();
    assert.equal(cfg.apiKey, "tp-test123");
    assert.equal(cfg.model, "mimo-v2-omni");
  });

  it("should warn when maxImageSize > 20MB", () => {
    const warnings = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { warnings.push(chunk); return true; };

    writeTestSettings({ MIMO_API_KEY: "tp-test" });
    loadConfig();

    process.stderr.write = orig;
    // 50MB default > 20MB threshold → should warn
    const hasWarning = warnings.some(w => w.includes("MB"));
    assert.ok(hasWarning, "should warn for large maxImageSize");
  });

  it("should apply maxImageSize default if not set", () => {
    writeTestSettings({ MIMO_API_KEY: "tp-test" });
    const cfg = loadConfig();
    assert.equal(cfg.maxImageSize, 50 * 1024 * 1024);
  });
});
