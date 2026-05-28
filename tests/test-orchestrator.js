import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze } from "../scripts/lib/orchestrator.js";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

// 10x10 蓝色 PNG
const MINI_PNG = Buffer.from([
  0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,0x00,0x00,0x00,0x0D,
  0x49,0x48,0x44,0x52,0x00,0x00,0x00,0x0A,0x00,0x00,0x00,0x0A,
  0x08,0x02,0x00,0x00,0x00,0x02,0x50,0x58,0xEA,0x00,0x00,0x00,
  0x11,0x49,0x44,0x41,0x54,0x78,0x9C,0x63,0x60,0x60,0xF8,0x8F,
  0x17,0x8D,0x4A,0x63,0x41,0x00,0xF0,0x83,0x63,0x9D,0xA8,0x09,
  0x34,0x3C,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,
  0x60,0x82
]);

// API 连通性预检
const apiKey = process.env.MIMO_API_KEY;
let apiAvailable = false;

async function probeApi() {
  if (!apiKey) return;
  try {
    const p = join(tmpdir(), "test-orch-probe.png");
    writeFileSync(p, MINI_PNG);
    try { await analyze(p, "describe"); apiAvailable = true; }
    finally { try { unlinkSync(p); } catch {} }
  } catch { /* Key 无效或网络不通 — 跳过 */ }
}

await probeApi();

describe("orchestrator", () => {
  it("should reject non-existent file", async () => {
    await assert.rejects(
      () => analyze("/nonexistent/file.png", "describe"),
      (err) => err.name === "ClientError"
    );
  });

  it("should reject unsupported mode", async () => {
    const p = join(tmpdir(), "test-orch.png");
    writeFileSync(p, MINI_PNG);
    try {
      await assert.rejects(
        () => analyze(p, "invalid-mode"),
        (err) => err.name === "ClientError"
      );
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });

  it("should analyze a real image end-to-end", { skip: !apiAvailable }, async () => {
    const p = join(tmpdir(), "test-orch-real.png");
    writeFileSync(p, MINI_PNG);
    try {
      const result = await analyze(p, "describe");
      assert.ok(result.length > 0, "should return analysis text");
    } finally {
      try { unlinkSync(p); } catch {}
    }
  });
});
