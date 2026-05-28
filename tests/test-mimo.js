import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MimoProvider } from "../scripts/lib/providers/mimo.js";
import { validateProvider } from "../scripts/lib/providers/provider.js";

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

  // 真实 API 测试 — 仅在 API Key 存在时运行
  const apiKey = process.env.MIMO_API_KEY;
  const runApiTests = apiKey && apiKey.length > 0;

  if (runApiTests) {
    it("healthCheck should return true with valid key", { skip: !runApiTests }, async () => {
      const p = new MimoProvider({ apiKey, baseUrl: undefined, model: "mimo-v2.5" });
      const healthy = await p.healthCheck();
      assert.equal(healthy, true);
    });

    it("should return valid result for describe mode", { skip: !runApiTests }, async () => {
      const p = new MimoProvider({ apiKey, baseUrl: undefined, model: "mimo-v2.5" });
      // 1x1 红色像素 PNG
      const miniPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await p.analyzeImage({ image: miniPngBase64 });
      assert.ok(result.content.length > 0);
      assert.ok(result.processingTimeMs > 0);
    });
  }
});
