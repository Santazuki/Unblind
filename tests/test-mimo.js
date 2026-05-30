import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GenericProvider } from "../scripts/lib/providers/generic-provider.js";
import { PROTOCOLS } from "../scripts/lib/providers/protocols.js";

// API 连通性预检
const apiKey = process.env.MIMO_API_KEY;
let apiAvailable = false;

async function probeApi() {
  if (!apiKey) return;
  try {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
      timeoutMs: 10_000,
    });
    const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    await p.analyzeImage({ image: miniPng, options: { mode: "describe", maxSize: 50 } });
    apiAvailable = true;
  } catch { /* Key 无效或网络不通 */ }
}

await probeApi();

describe("MimoProvider (v3 GenericProvider)", () => {
  it("should have name 'mimo'", () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://test.local",
      apiKey: "tp-test",
      model: "mimo-v2.5",
    });
    assert.equal(p.name, "mimo");
  });

  it("should expose execute and analyzeImage methods", () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://test.local",
      apiKey: "tp-test",
      model: "mimo-v2.5",
    });
    assert.equal(typeof p.execute, "function");
    assert.equal(typeof p.analyzeImage, "function");
    assert.equal(typeof p.healthCheck, "function");
  });

  it("healthCheck should return true with valid key", { skip: !apiAvailable }, async () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
    });
    const healthy = await p.healthCheck();
    assert.equal(healthy, true);
  });

  it("should return valid result for describe mode", { skip: !apiAvailable }, async () => {
    const p = new GenericProvider({
      name: "mimo",
      protocol: PROTOCOLS["anthropic-messages"],
      baseUrl: "https://api.xiaomimimo.com/anthropic",
      apiKey,
      model: "mimo-v2.5",
    });
    const miniPngBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
    const result = await p.analyzeImage({ image: miniPngBase64 });
    assert.ok(result.content.length > 0);
    assert.ok(result.processingTimeMs > 0);
  });
});
