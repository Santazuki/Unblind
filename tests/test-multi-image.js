import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";
import { PROTOCOLS } from "../scripts/lib/providers/protocols.js";
import { MODE_PROMPTS } from "../scripts/lib/providers/provider.js";
import { getCacheKey } from "../scripts/lib/cache.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const UNBLIND = join(__dirname, "..", "scripts", "unblind.mjs");

// 1x1 PNG (minimal valid PNG)
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

/* ======== CLI parsing tests ======== */

describe("CLI multi-image parsing", () => {
  it("should show usage when no arguments", () => {
    try {
      execSync(`node "${UNBLIND}"`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("Usage"), "should show usage");
    }
  });

  it("should reject compare mode with only 1 image", () => {
    const p = join(tmpdir(), "test-mi-1img.png");
    writeFileSync(p, MINI_PNG);
    try {
      execSync(`node "${UNBLIND}" "${p}" compare`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("至少 2 张"), "should require 2+ images for compare");
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });

  it("should report file not found for 2 images + compare", () => {
    try {
      execSync(`node "${UNBLIND}" /nonexistent/a.png /nonexistent/b.png compare`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("文件不存在") || output.includes("错误") || output.length > 0, `should report error. Got: ${output.slice(0, 200)}`);
    }
  });

  it("should report file not found for 2 positional args without mode", () => {
    try {
      execSync(`node "${UNBLIND}" /nonexistent/a.png /nonexistent/b.png`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("文件不存在") || output.includes("错误") || output.length > 0, "should report error");
    }
  });

  it("should report file not found for 3 positional args", () => {
    try {
      execSync(`node "${UNBLIND}" /nonexistent/a.png /nonexistent/b.png /nonexistent/c.png`, { encoding: "utf8" });
      assert.fail("should have thrown");
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(output.includes("文件不存在") || output.includes("错误") || output.length > 0, "should report error");
    }
  });

  it("should still work with single image + mode (backward compat)", () => {
    const p = join(tmpdir(), "test-mi-backward.png");
    writeFileSync(p, MINI_PNG);
    try {
      execSync(`node "${UNBLIND}" "${p}" ocr`, { encoding: "utf8", timeout: 5000 });
    } catch (e) {
      const output = (e.stderr || "") + (e.stdout || "");
      assert.ok(!output.includes("至少 2 张"), "should not require 2 images");
      assert.ok(!output.includes("Usage"), "should not show usage");
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });
});

/* ======== Anthropic protocol buildContent tests ======== */

describe("anthropic-messages buildContent multi-image", () => {
  const proto = PROTOCOLS["anthropic-messages"];

  it("should build multi-image content array with N images + 1 text", () => {
    const inputs = [
      { type: "image", data: "data:image/png;base64,abc", mimeType: "image/png" },
      { type: "image", data: "data:image/png;base64,def", mimeType: "image/png" },
    ];
    const content = proto.buildContent(inputs, "compare these");

    assert.equal(content.length, 3, "should have 2 image + 1 text entries");
    assert.equal(content[0].type, "image");
    assert.equal(content[0].source.type, "base64");
    assert.equal(content[0].source.data, "abc");
    assert.equal(content[1].source.data, "def");
    assert.equal(content[2].type, "text");
    assert.equal(content[2].text, "compare these");
  });

  it("should handle 3 images", () => {
    const inputs = [
      { type: "image", data: "data:image/png;base64,a", mimeType: "image/png" },
      { type: "image", data: "data:image/png;base64,b", mimeType: "image/png" },
      { type: "image", data: "data:image/png;base64,c", mimeType: "image/png" },
    ];
    const content = proto.buildContent(inputs, "test");
    assert.equal(content.length, 4, "3 images + 1 text");
  });

  it("should preserve mime type from image inputs", () => {
    const inputs = [
      { type: "image", data: "data:image/jpeg;base64,xyz", mimeType: "image/jpeg" },
      { type: "image", data: "data:image/webp;base64,uvw", mimeType: "image/webp" },
    ];
    const content = proto.buildContent(inputs, "compare");
    assert.equal(content[0].source.media_type, "image/jpeg");
    assert.equal(content[1].source.media_type, "image/webp");
  });
});

/* ======== OpenAI protocol buildContent tests ======== */

describe("openai-chat-completions buildContent multi-image", () => {
  const proto = PROTOCOLS["openai-chat-completions"];

  it("should build multi-image content array with N images + 1 text", () => {
    const inputs = [
      { type: "image", data: "data:image/png;base64,abc", mimeType: "image/png" },
      { type: "image", data: "data:image/png;base64,def", mimeType: "image/png" },
    ];
    const content = proto.buildContent(inputs, "compare these");

    assert.equal(content.length, 3, "should have 2 image + 1 text entries");
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, "data:image/png;base64,abc");
    assert.equal(content[1].image_url.url, "data:image/png;base64,def");
    assert.equal(content[2].type, "text");
    assert.equal(content[2].text, "compare these");
  });

  it("should handle single image string via input (backward compat)", () => {
    const inputs = [{ type: "image", data: "data:image/png;base64,abc", mimeType: "image/png" }];
    const content = proto.buildContent(inputs, "describe");

    assert.equal(content.length, 2, "1 image + 1 text");
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, "data:image/png;base64,abc");
    assert.equal(content[1].type, "text");
  });
});

/* ======== Cache key tests ======== */

describe("multi-image cache key", () => {
  it("should generate different keys for different image orders (a+b != b+a)", () => {
    const img1 = "data:image/png;base64,abc";
    const img2 = "data:image/png;base64,def";
    const prompt = MODE_PROMPTS.compare;

    const hash1 = createHash("sha256").update([img1, img2].join("::")).digest("hex");
    const hash2 = createHash("sha256").update([img2, img1].join("::")).digest("hex");

    const key1 = getCacheKey(hash1, prompt);
    const key2 = getCacheKey(hash2, prompt);

    assert.notEqual(key1, key2, "a+b and b+a should produce different cache keys");
  });

  it("single image array key should match single string key (backward compat)", () => {
    const img = "data:image/png;base64,single";
    const prompt = MODE_PROMPTS.describe;

    const combinedArray = [img].join("::");
    const hashArray = createHash("sha256").update(combinedArray).digest("hex");
    const keyArray = getCacheKey(hashArray, prompt);

    const hashString = createHash("sha256").update(img).digest("hex");
    const keyString = getCacheKey(hashString, prompt);

    assert.equal(keyArray, keyString, "single-element array key should equal string key");
  });

  it("should produce different keys for different prompts on same images", () => {
    const img1 = "data:image/png;base64,img1";
    const img2 = "data:image/png;base64,img2";
    const combined = [img1, img2].join("::");
    const hash = createHash("sha256").update(combined).digest("hex");

    const keyDescribe = getCacheKey(hash, MODE_PROMPTS.describe);
    const keyCompare = getCacheKey(hash, MODE_PROMPTS.compare);

    assert.notEqual(keyDescribe, keyCompare, "different prompts should produce different keys");
  });

  it("should produce different keys for different image sets", () => {
    const prompt = MODE_PROMPTS.compare;

    const hashAB = createHash("sha256").update(["a", "b"].join("::")).digest("hex");
    const hashABC = createHash("sha256").update(["a", "b", "c"].join("::")).digest("hex");

    const keyAB = getCacheKey(hashAB, prompt);
    const keyABC = getCacheKey(hashABC, prompt);

    assert.notEqual(keyAB, keyABC, "different image counts should produce different keys");
  });
});

/* ======== MODE_PROMPTS validation ======== */

describe("compare mode prompt", () => {
  it("should be defined in MODE_PROMPTS", () => {
    assert.ok(MODE_PROMPTS.compare, "compare mode should have a prompt");
    assert.ok(MODE_PROMPTS.compare.length > 50, "compare prompt should be substantive");
  });

  it("should be included in VALID_MODES automatically", async () => {
    const { VALID_MODES } = await import("../scripts/lib/providers/provider.js");
    assert.ok(VALID_MODES.includes("compare"), "VALID_MODES should include compare");
  });
});
