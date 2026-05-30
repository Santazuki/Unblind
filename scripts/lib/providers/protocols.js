// scripts/lib/providers/protocols.js

/**
 * @fileoverview 协议定义 — 纯函数集合
 * 每个协议族对象包含 6 个方法，覆盖一个 API 家族的全部差异。
 * 所有方法均为纯函数：输入 → 输出，零副作用。
 */

/**
 * 从 Base64 数据 URL 中剥离 data:...;base64, 前缀，返回纯 Base64 字符串。
 * @param {string} data - 可能包含 data: 前缀的 base64 字符串
 * @returns {string} 纯 base64 字符串
 */
function stripB64Prefix(data) {
  const i = data.indexOf(";base64,");
  return i >= 0 ? data.slice(i + 8) : data;
}

/**
 * 通用 parseError — 3 协议族共用。
 * 根据 HTTP status 和响应体将错误归入 auth / rate_limit / server / client。
 * @param {object} data - API 响应体
 * @param {number} status - HTTP 状态码
 * @returns {{category:string, message?:string}}
 */
function commonParseError(data, status) {
  const err = data.error || data;
  if (status === 401 || status === 403) return { category: "auth" };
  if (status === 429) return { category: "rate_limit" };
  if (status >= 500) return { category: "server" };
  return { category: "client", message: err.message };
}

/**
 * @typedef {Object} ProtocolMethods
 * @property {(model: string) => string} endpoint
 * @property {(apiKey: string) => Record<string,string>} auth
 * @property {(inputs: Array<{type:string,data:string,mimeType?:string}>, prompt: string) => Array<object>} buildContent
 * @property {(model: string, content: Array<object>, options: Object) => object} buildBody
 * @property {(data: object) => string} extractContent
 * @property {(data: object, status: number) => {category:string, message?:string}} parseError
 */

/** @type {Object<string, ProtocolMethods>} */
export const PROTOCOLS = {

  /** Anthropic Messages API */
  "anthropic-messages": {
    endpoint(_model) {
      return "/v1/messages";
    },

    auth(apiKey) {
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      };
    },

    buildContent(inputs, prompt) {
      const content = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: inp.mimeType || "image/png",
              data: stripB64Prefix(inp.data),
            },
          });
        } else if (inp.type === "text") {
          content.push({ type: "text", text: inp.data });
        }
      }
      content.push({ type: "text", text: prompt });
      return content;
    },

    buildBody(model, content, options) {
      const body = {
        model,
        max_tokens: options.maxTokens || 2048,
        messages: [{ role: "user", content }],
      };
      if (options.temperature != null) body.temperature = options.temperature;
      return body;
    },

    extractContent(data) {
      const text = data.content?.find(c => c.type === "text")?.text;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) { return commonParseError(data, status); },
  },

  /** OpenAI Chat Completions API */
  "openai-chat-completions": {
    endpoint(_model) {
      return "/chat/completions";
    },

    auth(apiKey) {
      return { Authorization: `Bearer ${apiKey}` };
    },

    buildContent(inputs, prompt) {
      const content = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          content.push({ type: "image_url", image_url: { url: inp.data } });
        } else if (inp.type === "text") {
          content.push({ type: "text", text: inp.data });
        }
      }
      content.push({ type: "text", text: prompt });
      return content;
    },

    buildBody(model, content, options) {
      const body = {
        model,
        max_tokens: options.maxTokens || 2048,
        messages: [{ role: "user", content }],
      };
      if (options.temperature != null) body.temperature = options.temperature;
      return body;
    },

    extractContent(data) {
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) { return commonParseError(data, status); },
  },

  /** Google Generative AI API */
  "google-generative-ai": {
    endpoint(model) {
      return `/v1beta/models/${model}:generateContent`;
    },

    auth(apiKey) {
      return { "x-goog-api-key": apiKey };
    },

    buildContent(inputs, prompt) {
      const parts = [];
      for (const inp of inputs) {
        if (inp.type === "image") {
          parts.push({
            inline_data: {
              mime_type: inp.mimeType || "image/png",
              data: stripB64Prefix(inp.data),
            },
          });
        } else if (inp.type === "text") {
          parts.push({ text: inp.data });
        }
      }
      parts.push({ text: prompt });
      return parts;
    },

    buildBody(model, parts, options) {
      const body = { contents: [{ parts }] };
      if (options.temperature != null) {
        body.generationConfig = { temperature: options.temperature };
      }
      return body;
    },

    extractContent(data) {
      const text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
      if (!text) throw new Error("No text content in response");
      return text;
    },

    parseError(data, status) { return commonParseError(data, status); },
  },
};
