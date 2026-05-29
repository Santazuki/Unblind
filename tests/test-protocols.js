// tests/test-protocols.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROTOCOLS } from "../scripts/lib/providers/protocols.js";

const IMAGE_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const IMAGE_2 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQg=";

describe("PROTOCOLS: openai-chat-completions", () => {
  const proto = PROTOCOLS["openai-chat-completions"];

  it("endpoint returns /chat/completions", () => {
    assert.equal(proto.endpoint("gpt-4o"), "/chat/completions");
  });

  it("auth returns Bearer header", () => {
    assert.deepStrictEqual(proto.auth("sk-test123"), { Authorization: "Bearer sk-test123" });
  });

  it("buildContent — single image", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const content = proto.buildContent(inputs, "Describe this image");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, IMAGE_1);
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "Describe this image");
  });

  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const content = proto.buildContent(inputs, "Compare these");
    assert.equal(content.length, 3);
    assert.equal(content[0].type, "image_url");
    assert.equal(content[0].image_url.url, IMAGE_1);
    assert.equal(content[1].type, "image_url");
    assert.equal(content[1].image_url.url, IMAGE_2);
    assert.equal(content[2].type, "text");
  });

  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Previous analysis result" }];
    const content = proto.buildContent(inputs, "Compare with this");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "text");
    assert.equal(content[0].text, "Previous analysis result");
    assert.equal(content[1].text, "Compare with this");
  });

  it("buildContent — mixed image+text inputs", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "text", data: "Reference: sunny day" },
    ];
    const content = proto.buildContent(inputs, "Analyze");
    assert.equal(content.length, 3);
    assert.equal(content[0].type, "image_url");
    assert.equal(content[1].type, "text");
    assert.equal(content[1].text, "Reference: sunny day");
    assert.equal(content[2].type, "text");
    assert.equal(content[2].text, "Analyze");
  });

  it("buildBody — default options", () => {
    const body = proto.buildBody("gpt-4o", [{ type: "text", text: "Hello" }], {});
    assert.equal(body.model, "gpt-4o");
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.messages.length, 1);
    assert.equal(body.messages[0].role, "user");
    assert.ok(Array.isArray(body.messages[0].content));
  });

  it("buildBody — custom maxTokens", () => {
    const body = proto.buildBody("gpt-4o", [], { maxTokens: 4096 });
    assert.equal(body.max_tokens, 4096);
  });

  it("buildBody — custom temperature", () => {
    const body = proto.buildBody("gpt-4o", [], { temperature: 0.7 });
    assert.equal(body.temperature, 0.7);
  });

  it("extractContent — valid response", () => {
    const data = { choices: [{ message: { content: "This is a cat" } }] };
    assert.equal(proto.extractContent(data), "This is a cat");
  });

  it("extractContent — empty choices should throw", () => {
    assert.throws(() => proto.extractContent({ choices: [] }), /No text content/);
  });

  it("extractContent — null message should throw", () => {
    assert.throws(() => proto.extractContent({ choices: [{}] }));
  });

  it("parseError — 401 maps to auth", () => {
    assert.deepStrictEqual(proto.parseError({ error: { message: "Unauthorized" } }, 401), { category: "auth" });
  });

  it("parseError — 403 maps to auth", () => {
    assert.deepStrictEqual(proto.parseError({}, 403), { category: "auth" });
  });

  it("parseError — 429 maps to rate_limit", () => {
    assert.deepStrictEqual(proto.parseError({ error: { message: "Rate limited" } }, 429), { category: "rate_limit" });
  });

  it("parseError — 500 maps to server", () => {
    assert.deepStrictEqual(proto.parseError({}, 500), { category: "server" });
  });

  it("parseError — 503 maps to server", () => {
    assert.deepStrictEqual(proto.parseError({}, 503), { category: "server" });
  });

  it("parseError — 400 maps to client with message", () => {
    const r = proto.parseError({ error: { message: "Bad request" } }, 400);
    assert.equal(r.category, "client");
    assert.equal(r.message, "Bad request");
  });
});

describe("PROTOCOLS: anthropic-messages", () => {
  const proto = PROTOCOLS["anthropic-messages"];

  it("endpoint returns /v1/messages", () => {
    assert.equal(proto.endpoint("claude-sonnet"), "/v1/messages");
  });

  it("auth returns x-api-key + anthropic-version headers", () => {
    const headers = proto.auth("sk-ant-test123");
    assert.equal(headers["x-api-key"], "sk-ant-test123");
    assert.equal(headers["anthropic-version"], "2023-06-01");
  });

  it("buildContent — strips data: prefix from base64", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const content = proto.buildContent(inputs, "Describe");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "image");
    assert.equal(content[0].source.type, "base64");
    assert.equal(content[0].source.media_type, "image/png");
    assert.ok(!content[0].source.data.includes("data:"), "Base64 prefix should be stripped");
    assert.ok(content[0].source.data.includes("iVBORw0KGgo"), "Should contain raw base64 data");
  });

  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const content = proto.buildContent(inputs, "Compare");
    assert.equal(content.length, 3);
    assert.equal(content[0].source.media_type, "image/png");
    assert.equal(content[1].source.media_type, "image/jpeg");
  });

  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Hello" }];
    const content = proto.buildContent(inputs, "World");
    assert.equal(content.length, 2);
    assert.equal(content[0].type, "text");
    assert.equal(content[0].text, "Hello");
    assert.equal(content[1].text, "World");
  });

  it("buildBody — default options", () => {
    const body = proto.buildBody("claude-sonnet-4-6-20250501", [{ type: "text", text: "Hi" }], {});
    assert.equal(body.model, "claude-sonnet-4-6-20250501");
    assert.equal(body.max_tokens, 2048);
    assert.equal(body.messages[0].role, "user");
  });

  it("extractContent — valid response", () => {
    const data = { content: [{ type: "text", text: "A beautiful sunset" }] };
    assert.equal(proto.extractContent(data), "A beautiful sunset");
  });

  it("extractContent — no text content should throw", () => {
    assert.throws(() => proto.extractContent({ content: [{ type: "image" }] }));
  });

  it("parseError — 401/429/500 categories", () => {
    assert.deepStrictEqual(proto.parseError({ error: { message: "Invalid key" } }, 401), { category: "auth" });
    assert.deepStrictEqual(proto.parseError({ type: "error", error: { type: "rate_limit_error", message: "Too fast" } }, 429), { category: "rate_limit" });
    assert.deepStrictEqual(proto.parseError({}, 500), { category: "server" });
  });
});

describe("PROTOCOLS: google-generative-ai", () => {
  const proto = PROTOCOLS["google-generative-ai"];

  it("endpoint includes model in path", () => {
    assert.equal(proto.endpoint("gemini-2.5-flash"), "/v1beta/models/gemini-2.5-flash:generateContent");
  });

  it("auth returns x-goog-api-key header", () => {
    assert.deepStrictEqual(proto.auth("AIzaTest123"), { "x-goog-api-key": "AIzaTest123" });
  });

  it("buildContent — single image", () => {
    const inputs = [{ type: "image", data: IMAGE_1, mimeType: "image/png" }];
    const parts = proto.buildContent(inputs, "Describe");
    assert.equal(parts.length, 2);
    assert.ok(parts[0].inline_data);
    assert.equal(parts[0].inline_data.mime_type, "image/png");
    assert.ok(parts[0].inline_data.data.includes("iVBORw0KGgo"));
    assert.equal(parts[1].text, "Describe");
  });

  it("buildContent — multiple images", () => {
    const inputs = [
      { type: "image", data: IMAGE_1, mimeType: "image/png" },
      { type: "image", data: IMAGE_2, mimeType: "image/jpeg" },
    ];
    const parts = proto.buildContent(inputs, "Compare");
    assert.equal(parts.length, 3);
    assert.equal(parts[0].inline_data.mime_type, "image/png");
    assert.equal(parts[1].inline_data.mime_type, "image/jpeg");
  });

  it("buildContent — text input", () => {
    const inputs = [{ type: "text", data: "Context" }];
    const parts = proto.buildContent(inputs, "Question?");
    assert.equal(parts.length, 2);
    assert.equal(parts[0].text, "Context");
    assert.equal(parts[1].text, "Question?");
  });

  it("buildBody — default options", () => {
    const body = proto.buildBody("gemini-2.5-flash", [{ text: "Hi" }], {});
    assert.equal(body.contents.length, 1);
    assert.deepStrictEqual(body.contents[0].parts, [{ text: "Hi" }]);
  });

  it("extractContent — valid response", () => {
    const data = { candidates: [{ content: { parts: [{ text: "A cat on a sofa" }] } }] };
    assert.equal(proto.extractContent(data), "A cat on a sofa");
  });

  it("extractContent — no candidates should throw", () => {
    assert.throws(() => proto.extractContent({ candidates: [] }));
  });

  it("parseError — 401/429 categories", () => {
    assert.deepStrictEqual(proto.parseError({ error: { message: "Invalid API key" } }, 401), { category: "auth" });
    assert.deepStrictEqual(proto.parseError({ error: { message: "Quota exceeded" } }, 429), { category: "rate_limit" });
  });
});
