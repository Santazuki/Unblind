import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ClientError, ServerError, NetworkError, formatError } from "../scripts/lib/errorHandler.js";

describe("errorHandler", () => {
  it("ClientError should contain type, reason, suggestion", () => {
    const err = new ClientError("图片格式不支持", { suggestion: "请使用 jpg/png/webp 格式" });
    assert.ok(err instanceof Error);
    assert.equal(err.name, "ClientError");
    assert.ok(err.reason.includes("图片格式不支持"));
    assert.ok(err.suggestion.includes("jpg/png/webp"));
  });

  it("ServerError should contain type and statusCode", () => {
    const err = new ServerError("Mimo 服务异常", { statusCode: 500 });
    assert.equal(err.name, "ServerError");
    assert.equal(err.statusCode, 500);
  });

  it("NetworkError should contain type", () => {
    const err = new NetworkError("DNS 解析失败", { host: "api.mimo.dev" });
    assert.equal(err.name, "NetworkError");
    assert.equal(err.host, "api.mimo.dev");
  });

  it("formatError should produce Chinese user-facing message", () => {
    const err = new ClientError("API Key 无效", {
      suggestion: "请在 Mimo 控制台检查 API Key 是否正确",
      statusCode: 401,
    });
    const msg = formatError(err);
    assert.ok(msg.includes("API Key 无效"));
    assert.ok(msg.includes("控制台"));
    assert.ok(msg.includes("401"));
  });
});
