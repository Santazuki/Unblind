// tests/test-generic-provider.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GenericProvider } from "../scripts/lib/providers/generic-provider.js";
import { ClientError } from "../scripts/lib/errorHandler.js";

// Minimal mock protocol for testing in isolation
const MOCK_PROTOCOL = {
  endpoint: () => "/test/endpoint",
  auth: (apiKey) => ({ "X-Test-Key": apiKey }),
  buildContent: (inputs, prompt) => [...inputs, { type: "text", text: prompt }],
  buildBody: (model, content, opts) => ({ model, max_tokens: opts.maxTokens || 2048, content }),
  extractContent: (data) => data.text || "",
  parseError: (_data, status) => {
    if (status === 401 || status === 403) return { category: "auth" };
    if (status === 429) return { category: "rate_limit" };
    if (status >= 500) return { category: "server" };
    return { category: "client" };
  },
};

// Helper: create GenericProvider with mock protocol
function createProvider(overrides = {}) {
  return new GenericProvider({
    name: "test-provider",
    protocol: MOCK_PROTOCOL,
    baseUrl: "https://test.local",
    apiKey: "sk-test123",
    model: "test-model",
    timeoutMs: 5000,
    overrides,
  });
}

describe("GenericProvider", () => {
  // ============ Constructor validation ============
  describe("constructor", () => {
    it("should throw if protocol is null/undefined", () => {
      assert.throws(
        () => new GenericProvider({ name: "x", protocol: null, apiKey: "k", baseUrl: "https://t.local", model: "m" }),
        (err) => err instanceof ClientError && err.message.includes("协议")
      );
    });

    it("should throw if protocol is not an object", () => {
      assert.throws(
        () => new GenericProvider({ name: "x", protocol: "not_an_object", apiKey: "k", baseUrl: "https://t.local", model: "m" }),
        (err) => err instanceof ClientError && err.message.includes("协议")
      );
    });

    it("should throw if overrides contains disallowed key", () => {
      assert.throws(
        () => createProvider({ auth: () => ({}) }),
        (err) => err instanceof ClientError && err.message.includes("不允许覆盖")
      );
    });

    it("should throw if override key does not exist in protocol", () => {
      const protoNoBuildBody = { ...MOCK_PROTOCOL };
      delete protoNoBuildBody.buildBody;
      assert.throws(
        () => new GenericProvider({
          name: "x", protocol: protoNoBuildBody, baseUrl: "https://t.local",
          apiKey: "k", model: "m",
          overrides: { buildBody: () => ({}) },
        }),
        (err) => err instanceof ClientError && err.message.includes("没有方法")
      );
    });

    it("should throw when overrides value is not a function", () => {
      assert.throws(
        () => createProvider({ buildBody: "not_a_function" }),
        (err) => err instanceof ClientError && err.message.includes("必须是函数")
      );
    });

    it("should accept valid overrides: buildBody", () => {
      const gp = createProvider({
        buildBody: (proto, model, content, opts) =>
          proto.buildBody(model, content, { ...opts, maxTokens: 100 }),
      });
      assert.equal(gp.name, "test-provider");
    });

    it("should accept valid overrides: parseError", () => {
      const gp = createProvider({
        parseError: (proto, data, status) => proto.parseError(data, status),
      });
      assert.equal(gp.name, "test-provider");
    });

    it("should set all properties from constructor", () => {
      const gp = createProvider();
      assert.equal(gp.name, "test-provider");
    });
  });

  // ============ Interface existence ============
  describe("interface", () => {
    it("should expose execute method", () => {
      const gp = createProvider();
      assert.equal(typeof gp.execute, "function");
    });

    it("should expose analyzeImage method (backward compat)", () => {
      const gp = createProvider();
      assert.equal(typeof gp.analyzeImage, "function");
    });

    it("should expose healthCheck method", () => {
      const gp = createProvider();
      assert.equal(typeof gp.healthCheck, "function");
    });
  });

  // ============ execute behavior (with fetch mock) ============
  describe("execute", () => {
    it("should call buildContent with inputs and prompt", async () => {
      let capturedInputs = null, capturedPrompt = null;
      const proto = {
        ...MOCK_PROTOCOL,
        buildContent: (inputs, prompt) => {
          capturedInputs = inputs;
          capturedPrompt = prompt;
          return [{ type: "text", text: prompt }];
        },
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://t.local",
        apiKey: "k", model: "m",
      });
      // Will fail on apiRequest (no network), but we test the call chain up to that point
      try {
        await gp.execute({ inputs: [{ type: "text", data: "hello" }], prompt: "analyze" });
      } catch (e) {
        // Expected: apiRequest will throw NetworkError
      }
      assert.deepStrictEqual(capturedInputs, [{ type: "text", data: "hello" }]);
      assert.equal(capturedPrompt, "analyze");
    });

    it("should call buildBody with model, content, and options", async () => {
      let capturedModel = null, capturedOpts = null;
      const proto = {
        ...MOCK_PROTOCOL,
        buildBody: (model, content, opts) => {
          capturedModel = model;
          capturedOpts = opts;
          return { model, max_tokens: opts.maxTokens || 2048, content };
        },
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://t.local",
        apiKey: "k", model: "test-model",
      });
      try {
        await gp.execute({ inputs: [], prompt: "hi", options: { maxTokens: 100, temperature: 0.5 } });
      } catch (e) { /* expected */ }
      assert.equal(capturedModel, "test-model");
      assert.equal(capturedOpts.maxTokens, 100);
    });

    it("should use override buildBody when provided", async () => {
      let overrideCalled = false;
      const gp = createProvider({
        buildBody: (proto, model, content, opts) => {
          overrideCalled = true;
          const body = proto.buildBody(model, content, opts);
          body.max_tokens = Math.min(body.max_tokens, 10);
          return body;
        },
      });
      try {
        await gp.execute({ inputs: [], prompt: "hi" });
      } catch (e) { /* expected */ }
      assert.ok(overrideCalled, "override should be called");
    });

    it("should construct URL from baseUrl and endpoint", async () => {
      const proto = {
        ...MOCK_PROTOCOL,
        endpoint: () => "/custom/endpoint",
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://api.example.com",
        apiKey: "k", model: "m",
      });
      // The URL will be "https://api.example.com/custom/endpoint"
      // Should be NetworkError (fetch fails), not ClientError (URL construction fails)
      try {
        await gp.execute({ inputs: [], prompt: "hi" });
      } catch (e) {
        assert.notEqual(e.name, "ClientError");
      }
    });
  });

  // ============ analyzeImage backward compat ============
  describe("analyzeImage", () => {
    it("should convert single image string to inputs", async () => {
      let capturedInputs = null;
      const proto = {
        ...MOCK_PROTOCOL,
        buildContent: (inputs, prompt) => {
          capturedInputs = inputs;
          return [{ type: "text", text: prompt }];
        },
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://t.local",
        apiKey: "k", model: "m",
      });
      try {
        await gp.analyzeImage({
          image: "data:image/png;base64,abc123",
          prompt: "describe",
        });
      } catch (e) { /* expected */ }
      assert.ok(capturedInputs, "inputs should be captured");
      assert.equal(capturedInputs.length, 1);
      assert.equal(capturedInputs[0].type, "image");
      assert.equal(capturedInputs[0].mimeType, "image/png");
    });

    it("should handle multi-image array", async () => {
      let capturedInputs = null;
      const proto = {
        ...MOCK_PROTOCOL,
        buildContent: (inputs, prompt) => {
          capturedInputs = inputs;
          return [{ type: "text", text: prompt }];
        },
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://t.local",
        apiKey: "k", model: "m",
      });
      const images = [
        { base64: "data:image/png;base64,a", mimeType: "image/png" },
        { base64: "data:image/jpeg;base64,b", mimeType: "image/jpeg" },
      ];
      try {
        await gp.analyzeImage({ image: images, prompt: "compare" });
      } catch (e) { /* expected */ }
      assert.ok(capturedInputs);
      assert.equal(capturedInputs.length, 2);
      assert.equal(capturedInputs[0].mimeType, "image/png");
      assert.equal(capturedInputs[1].mimeType, "image/jpeg");
    });

    it("should use mode prompt when no custom prompt provided", async () => {
      let capturedPrompt = null;
      const proto = {
        ...MOCK_PROTOCOL,
        buildContent: (inputs, prompt) => {
          capturedPrompt = prompt;
          return [{ type: "text", text: prompt }];
        },
      };
      const gp = new GenericProvider({
        name: "test", protocol: proto, baseUrl: "https://t.local",
        apiKey: "k", model: "m",
      });
      try {
        await gp.analyzeImage({
          image: "data:image/png;base64,x",
          options: { mode: "ocr" },
        });
      } catch (e) { /* expected */ }
      // Should be MODE_PROMPTS["ocr"]
      assert.ok(capturedPrompt.includes("Extract all text"), `Got: ${capturedPrompt?.slice(0, 50)}`);
    });
  });
});
