import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { processImage } from "../scripts/lib/imageProcessor.js";
import { ClientError } from "../scripts/lib/errorHandler.js";
import { formatError } from "../scripts/lib/errorHandler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNBLIND = join(__dirname, "..", "scripts", "unblind.mjs");

// ─── Test Helpers ──────────────────────────────────────────

function makeTempFile(name, content) {
  const p = join(tmpdir(), `unblind-sec-${name}`);
  writeFileSync(p, content);
  return p;
}

/** Run CLI via spawnSync (no shell interpretation — safe for metacharacter tests) */
function runCLI(args, env = {}) {
  return spawnSync("node", [UNBLIND, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

// 1×1 red pixel PNG (70 bytes)
function miniPNG() {
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x00, 0x03, 0x00, 0x01, 0x47, 0x53, 0x22,
    0xDE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82,
  ]);
}

// ─── Security Tests ─────────────────────────────────────────

describe("Security", () => {
  // ==========================================================
  //  1. Path Traversal
  // ==========================================================
  describe("Path Traversal", () => {
    it("should reject path with ../ sequences (no extension)", () => {
      const r = runCLI(["../../../etc/passwd"]);
      assert.notEqual(r.status, 0, "should exit non-zero");
      const output = (r.stderr || "") + (r.stdout || "");
      assert.ok(
        output.includes("格式") || output.includes("错误"),
        `should reject with format error. Got: ${output.slice(0, 200)}`,
      );
    });

    it("should reject path with ../ sequences and valid extension", () => {
      const r = runCLI(["../../../etc/shadow.png"]);
      assert.notEqual(r.status, 0, "should exit non-zero");
      const output = (r.stderr || "") + (r.stdout || "");
      assert.ok(
        output.includes("文件不存在") ||
          output.includes("错误") ||
          output.includes("不匹配"),
        `should reject traversal attempt. Got: ${output.slice(0, 200)}`,
      );
    });
  });

  // ==========================================================
  //  2. Shell Metacharacter Injection
  // ==========================================================
  describe("Shell Injection", () => {
    const vectors = [
      ["backtick", "`id`"],
      ["semicolon", "; rm -rf /"],
      ["pipe", "| whoami"],
      ["subshell substitution", "$(whoami)"],
      ["ampersand", "& del /F /Q *"],
    ];

    for (const [name, vector] of vectors) {
      it(`should reject path containing shell metacharacter: ${name}`, () => {
        // spawnSync passes args literally — no shell interpretation
        const r = runCLI([vector]);
        assert.notEqual(r.status, 0, "should exit non-zero");
        const output = (r.stderr || "") + (r.stdout || "");
        assert.ok(
          output.includes("格式") ||
            output.includes("错误") ||
            output.includes("Usage"),
          `should gracefully reject "${vector}". Got: ${output.slice(0, 200)}`,
        );
      });
    }
  });

  // ==========================================================
  //  3. File Content Validation
  // ==========================================================
  describe("File Validation", () => {
    it("should reject empty file", async () => {
      const p = makeTempFile("empty.png", Buffer.alloc(0));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("为空"),
          "empty file should throw ClientError with '为空'",
        );
      } finally {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    });

    it("should reject files exceeding size limit", async () => {
      // Real PNG (70 bytes) with a very low maxImageSize (50 bytes)
      const p = makeTempFile("oversized.png", miniPNG());
      try {
        await assert.rejects(
          () => processImage(p, { maxImageSize: 50 }),
          (err) => err instanceof ClientError && err.reason.includes("过大"),
          "oversized file should throw ClientError with '过大'",
        );
      } finally {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    });

    it("should reject unsupported formats", async () => {
      const badExts = [".exe", ".php", ".dll", ".jar", ".py"];
      for (const ext of badExts) {
        const p = makeTempFile(`bad${ext}`, Buffer.from("fake data"));
        try {
          await assert.rejects(
            () => processImage(p),
            (err) => err instanceof ClientError && err.reason.includes("格式"),
            `should reject .${ext} extension`,
          );
        } finally {
          try { unlinkSync(p); } catch { /* ignore */ }
        }
      }
    });

    it("should reject mismatched PNG magic bytes", async () => {
      // .png extension but content is plain text
      const p = makeTempFile("fake.png", Buffer.from("not a png file"));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("不匹配"),
          "fake .png should fail magic byte check",
        );
      } finally {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    });

    it("should reject mismatched JPEG magic bytes", async () => {
      // .jpg extension but content is not JPEG
      const p = makeTempFile("fake.jpg", Buffer.from("this is not a jpeg image"));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("不匹配"),
          "fake .jpg should fail magic byte check",
        );
      } finally {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    });
  });

  // ==========================================================
  //  4. API Key Protection
  // ==========================================================
  describe("API Key Protection", () => {
    it("should mask API key in --config output", () => {
      const testKey = "sk-ant-test123456secret";
      const r = runCLI(["--config"], { MIMO_API_KEY: testKey });

      assert.equal(r.status, 0, "--config should exit 0");
      const prefix = testKey.slice(0, 3);
      assert.ok(
        r.stdout.includes(`${prefix}***`),
        `should show first 3 chars ("${prefix}") + ***`,
      );

      // The suffix (everything after prefix) must NOT appear in output
      const keySuffix = "test123456secret";
      assert.ok(
        !r.stdout.includes(keySuffix),
        "must not expose key beyond first 3 characters",
      );
    });

    it("should not include full API key in any output channel", () => {
      const testKey = "sk-ant-full-key-xyz789";
      const r = runCLI(["--config"], { MIMO_API_KEY: testKey });

      assert.equal(r.status, 0, "--config should exit 0");
      // Check both stdout and stderr
      const allOutput = (r.stdout || "") + (r.stderr || "");
      assert.ok(
        !allOutput.includes("sk-ant-full-key-xyz789"),
        "full key must not appear anywhere in output",
      );
    });
  });

  // ==========================================================
  //  5. Error Message Safety  (no path leakage)
  // ==========================================================
  describe("Error Message Safety", () => {
    it("formatError should not include file paths", () => {
      const err = new ClientError("文件不存在", {
        suggestion: "请检查文件路径是否正确",
      });
      const msg = formatError(err);
      assert.ok(msg.includes("文件不存在"), "should contain the error reason");
      assert.ok(!msg.includes("/"), "should not contain any path separator");
    });

    it("should not leak path in file-not-found error", async () => {
      const p = "C:/nonexistent_dir_unblind/image.png";
      let caught = false;
      try {
        await processImage(p);
      } catch (err) {
        caught = true;
        assert.ok(err instanceof ClientError, "should throw ClientError");
        // The reason must be the generic "文件不存在", NOT containing the resolved path
        assert.strictEqual(
          err.reason,
          "文件不存在",
          "file-not-found reason must not include the file path",
        );
      }
      assert.ok(caught, "should have thrown");
    });

    it("should not leak path in format error", async () => {
      const p = makeTempFile("leak-test.exe", Buffer.from("some data"));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => {
            assert.ok(err instanceof ClientError);
            assert.ok(
              !err.reason.includes("leak-test.exe"),
              "format error reason must not contain the file name",
            );
            assert.ok(err.reason.includes("格式"), "format error should mention format");
            return true;
          },
        );
      } finally {
        try { unlinkSync(p); } catch { /* ignore */ }
      }
    });

    it("CLI error output should not contain user-supplied path segment", () => {
      // Use a distinctive marker path that should not appear in the user-facing error
      const marker = "zxcvbnm-test-path-leak";
      const r = runCLI([`/${marker}/image.png`]);
      const stderr = r.stderr || "";

      // The JSON log line may contain path suffix (truncated to 30 chars) — by design.
      // But the user-facing error line (❌) must not include the path.
      const errorLine = stderr.split("\n").find((l) => l.includes("❌"));
      if (errorLine) {
        assert.ok(
          !errorLine.includes(marker),
          "user-facing error line (❌) must not contain the user-supplied path",
        );
      }
    });
  });
});
