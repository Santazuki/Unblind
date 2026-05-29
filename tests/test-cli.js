import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNBLIND = join(__dirname, "..", "scripts", "unblind.mjs");

const MINI_PNG = Buffer.from([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
  0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
  0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
  0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
  0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
  0x54,0x08,0xD7,0x63,0xF8,0xCF,0xC0,0x00,
  0x00,0x00,0x03,0x00,0x01,0x47,0x53,0x22,
  0xDE,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
  0x44,0xAE,0x42,0x60,0x82
]);

describe("CLI", () => {
  it("should run health check", () => {
    try {
      const result = execSync(`node "${UNBLIND}" --health`, {
        encoding: "utf8",
        env: { ...process.env },
      });
      assert.ok(result.includes("健康检查"), "should show health check");
    } catch (e) {
      // --health 可能因网络问题 exit 1，但输出仍应包含诊断信息
      const output = (e.stdout || "") + (e.stderr || "");
      assert.ok(output.includes("健康检查"), "should show health check even on failure");
    }
  });

  it("should print usage when no arguments", () => {
    try {
      execSync(`node "${UNBLIND}"`, { encoding: "utf8", env: { ...process.env } });
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("Usage"), "should show usage");
    }
  });

  it("should fail for non-existent file", () => {
    try {
      execSync(`node "${UNBLIND}" /nonexistent/file.png`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("文件不存在") || output.includes("错误"),
        "should report file not found");
    }
  });

  it("should fail for invalid file format", () => {
    const p = join(tmpdir(), "test-cli.txt");
    writeFileSync(p, "not an image");
    try {
      execSync(`node "${UNBLIND}" "${p}"`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("不支持的图片格式") || output.includes("格式") || output.includes("错误"),
        `should report error. Got: ${output.slice(0, 200)}`);
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });

  it("should show config", () => {
    const result = execSync(`node "${UNBLIND}" --config`, {
      encoding: "utf8",
      env: { ...process.env },
    });
    assert.ok(result.includes("当前配置"), "should show config");
    assert.ok(result.includes("视觉模型"), "should show model");
  });

  it("should reject invalid model", () => {
    try {
      execSync(`node "${UNBLIND}" --set-model invalid-model`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("无效模型"), "should reject invalid model");
    }
  });
});
