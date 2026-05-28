import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { processImage, validateFormat } from "../scripts/lib/imageProcessor.js";
import { ClientError } from "../scripts/lib/errorHandler.js";

function makeTempFile(name, content) {
  const p = join(tmpdir(), name);
  writeFileSync(p, content);
  return p;
}

// 1x1 pixel red PNG (minimal valid PNG)
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

describe("imageProcessor", () => {
  describe("validateFormat", () => {
    it("should accept jpg/png/gif/webp/bmp/svg", () => {
      assert.equal(validateFormat("test.jpg"), true);
      assert.equal(validateFormat("test.png"), true);
      assert.equal(validateFormat("test.gif"), true);
      assert.equal(validateFormat("test.webp"), true);
      assert.equal(validateFormat("test.bmp"), true);
      assert.equal(validateFormat("test.svg"), true);
      assert.equal(validateFormat("TEST.JPG"), true);
    });

    it("should reject unsupported formats", () => {
      assert.equal(validateFormat("test.pdf"), false);
      assert.equal(validateFormat("test.tiff"), false);
      assert.equal(validateFormat("test"), false);
    });
  });

  describe("processImage", () => {
    it("should encode a valid PNG to base64 data URL", async () => {
      const p = makeTempFile("test-unblind.png", MINI_PNG);
      try {
        const result = await processImage(p);
        assert.ok(result.base64.startsWith("data:image/png;base64,"));
        assert.ok(result.size > 0);
        assert.equal(result.mimeType, "image/png");
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });

    it("should throw ClientError for non-existent file", async () => {
      await assert.rejects(
        () => processImage("/nonexistent/file.jpg"),
        (err) => err instanceof ClientError && err.reason.includes("文件不存在")
      );
    });

    it("should throw ClientError for empty file", async () => {
      const p = makeTempFile("empty.png", Buffer.alloc(0));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("文件为空")
        );
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });

    it("should throw ClientError for unsupported format", async () => {
      const p = makeTempFile("test.pdf", Buffer.from("not a pdf"));
      try {
        await assert.rejects(
          () => processImage(p),
          (err) => err instanceof ClientError && err.reason.includes("格式")
        );
      } finally {
        try { unlinkSync(p); } catch {}
      }
    });
  });
});
