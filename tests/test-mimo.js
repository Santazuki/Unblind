import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { MimoProvider } from "../scripts/lib/providers/mimo.js";
import { validateProvider } from "../scripts/lib/providers/provider.js";

// API 连通性预检
const apiKey = process.env.MIMO_API_KEY;
let apiAvailable = false;

async function probeApi() {
  if (!apiKey) return;
  try {
    const p = new MimoProvider({ apiKey, model: "mimo-v2.5", timeoutMs: 10_000 });
    const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    await p.analyzeImage({ image: miniPng, options: { mode: "describe", maxSize: 50 } });
    apiAvailable = true;
  } catch { /* Key 无效或网络不通 — 跳过 API 测试 */ }
}

await probeApi();

describe("MimoProvider", () => {
  it("should pass interface validation", () => {
    const p = new MimoProvider({ apiKey: "tp-test", baseUrl: "https://test.local", model: "mimo-v2.5" });
    const { valid, missing } = validateProvider(p);
    assert.ok(valid, `missing: ${missing.join(", ")}`);
  });

  it("should have name 'mimo'", () => {
    const p = new MimoProvider({ apiKey: "tp-test", baseUrl: "https://test.local" });
    assert.equal(p.name, "mimo");
  });

  it("should throw ClientError when API key is missing", async () => {
    const p = new MimoProvider({ apiKey: "", baseUrl: "https://test.local" });
    await assert.rejects(
      () => p.analyzeImage({ image: "data:image/png;base64,test" }),
      (err) => err.name === "ClientError"
    );
  });

  it("healthCheck should return true with valid key", { skip: !apiAvailable }, async () => {
    const p = new MimoProvider({ apiKey, model: "mimo-v2.5" });
    const healthy = await p.healthCheck();
    assert.equal(healthy, true);
  });

  it("should return valid result for describe mode", { skip: !apiAvailable }, async () => {
    const p = new MimoProvider({ apiKey, model: "mimo-v2.5" });
    const miniPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const result = await p.analyzeImage({ image: miniPngBase64 });
    assert.ok(result.content.length > 0);
    assert.ok(result.processingTimeMs > 0);
  });
});
