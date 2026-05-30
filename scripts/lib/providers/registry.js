import { GenericProvider } from "./generic-provider.js";
import { PROTOCOLS } from "./protocols.js";
import { log } from "../logger.js";
import { GenericProvider } from "./generic-provider.js";
import { PROTOCOLS } from "./protocols.js";

/**
 * Provider 注册表 — 纯数据
 * 新增 Provider = 加 1 行（不写逻辑代码）
 * overrides 仅允许 buildBody 和 parseError
 */
export const REGISTRY = [
  // ── OpenAI 协议家族 (5 Provider) ──
  {
    name: "openai",
    protocol: "openai-chat-completions",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    limits: { rpm: 500, tpm: 2000000 },
  },
  {
    name: "groq",
    protocol: "openai-chat-completions",
    envKey: "GROQ_API_KEY",
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    model: process.env.GROQ_MODEL || "llama-4-vision",
    limits: { rpm: 30, tpm: 30000 },
    overrides: {
      buildBody(proto, model, content, opts) {
        const body = proto.buildBody(model, content, opts);
        body.max_tokens = Math.min(body.max_tokens, 4096);
        return body;
      },
    },
  },
  {
    name: "together",
    protocol: "openai-chat-completions",
    envKey: "TOGETHER_API_KEY",
    baseUrl: process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1",
    model: process.env.TOGETHER_MODEL || "Llama-4-Maverick",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "fireworks",
    protocol: "openai-chat-completions",
    envKey: "FIREWORKS_API_KEY",
    baseUrl: process.env.FIREWORKS_BASE_URL || "https://api.fireworks.ai/inference/v1",
    model: process.env.FIREWORKS_MODEL || "llama-v4",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "ollama",
    protocol: "openai-chat-completions",
    envKey: "OLLAMA_BASE_URL",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: "llama3.2-vision",
    limits: {},
  },

  // ── Anthropic 协议家族 ──
  {
    name: "mimo",
    protocol: "anthropic-messages",
    envKey: "MIMO_API_KEY",
    baseUrl: "",
    model: "mimo-v2.5",
    limits: { rpm: 60, rpd: 1000, tpm: 100000 },
  },

  // ── Google 协议家族 ──
  {
    name: "gemini",
    protocol: "google-generative-ai",
    envKey: "GEMINI_API_KEY",
    baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    limits: { rpm: 15, rpd: 1500, tpm: 1000000 },
  },
];

/**
 * 加载已配置的 Provider，按 order 排序
 * @param {string} order — "openai,groq,mimo"
 * @param {object} opts — { model, timeoutMs, baseUrls }
 * @returns {Array<{ provider: GenericProvider, name: string }>}
 */
export function loadProviders(order, opts = {}) {
  const { model, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;

    const proto = PROTOCOLS[entry.protocol];
    if (!proto) {
      log("warn", "registry", "unknown_protocol", { provider: entry.name, protocol: entry.protocol });
      continue;
    }

    const baseUrl = baseUrls[entry.name] || entry.baseUrl;
    const providerModel = model || entry.model;

    try {
      available.set(entry.name, {
        provider: new GenericProvider({
          name: entry.name,
          protocol: proto,
          baseUrl,
          apiKey: key,
          model: providerModel,
          timeoutMs,
          overrides: entry.overrides || {},
        }),
        name: entry.name,
      });
    } catch (err) {
      log("warn", "registry", "provider_init_failed", { provider: entry.name, error: err.message });
    }
  }

  const ordered = order.split(",").map(s => s.trim());
  const result = [];
  for (const name of ordered) {
    if (available.has(name)) result.push(available.get(name));
  }

  log("debug", "registry", "providers_loaded", { order, count: result.length });
  return result;
}

// ========== v3.0 协议驱动注册表 ==========

/**
 * v3.0 Provider 注册表 — 纯数据
 * 新增 Provider = 加 1 行（不写逻辑代码）
 */
export const REGISTRY_V3 = [
  // ── OpenAI 协议家族 (5 Provider) ──
  {
    name: "openai",
    protocol: "openai-chat-completions",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    limits: { rpm: 500, tpm: 2000000 },
  },
  {
    name: "groq",
    protocol: "openai-chat-completions",
    envKey: "GROQ_API_KEY",
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    model: process.env.GROQ_MODEL || "llama-4-vision",
    limits: { rpm: 30, tpm: 30000 },
    overrides: {
      buildBody(proto, model, content, opts) {
        const body = proto.buildBody(model, content, opts);
        body.max_tokens = Math.min(body.max_tokens, 4096);
        return body;
      },
    },
  },
  {
    name: "together",
    protocol: "openai-chat-completions",
    envKey: "TOGETHER_API_KEY",
    baseUrl: process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1",
    model: process.env.TOGETHER_MODEL || "Llama-4-Maverick",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "fireworks",
    protocol: "openai-chat-completions",
    envKey: "FIREWORKS_API_KEY",
    baseUrl: process.env.FIREWORKS_BASE_URL || "https://api.fireworks.ai/inference/v1",
    model: process.env.FIREWORKS_MODEL || "llama-v4",
    limits: { rpm: 60, tpm: 60000 },
  },
  {
    name: "ollama",
    protocol: "openai-chat-completions",
    envKey: "OLLAMA_BASE_URL",
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
    model: "llama3.2-vision",
    limits: {},
  },

  // ── Anthropic 协议家族 ──
  {
    name: "mimo",
    protocol: "anthropic-messages",
    envKey: "MIMO_API_KEY",
    baseUrl: "",
    model: "mimo-v2.5",
    limits: { rpm: 60, rpd: 1000, tpm: 100000 },
  },

  // ── Google 协议家族 ──
  {
    name: "gemini",
    protocol: "google-generative-ai",
    envKey: "GEMINI_API_KEY",
    baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    limits: { rpm: 15, rpd: 1500, tpm: 1000000 },
  },
];

/**
 * v3.0 加载已配置的 Provider
 * @param {string} order — "openai,groq,mimo"
 * @param {object} opts — { model, timeoutMs, baseUrls }
 * @returns {Array<{ provider: GenericProvider, name: string }>}
 */
export function loadProvidersV3(order, opts = {}) {
  const { model, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY_V3) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;

    const proto = PROTOCOLS[entry.protocol];
    if (!proto) {
      log("warn", "registry", "unknown_protocol", { provider: entry.name, protocol: entry.protocol });
      continue;
    }

    const baseUrl = baseUrls[entry.name] || entry.baseUrl;
    const providerModel = model || entry.model;

    try {
      available.set(entry.name, {
        provider: new GenericProvider({
          name: entry.name,
          protocol: proto,
          baseUrl,
          apiKey: key,
          model: providerModel,
          timeoutMs,
          overrides: entry.overrides || {},
        }),
        name: entry.name,
      });
    } catch (err) {
      log("warn", "registry", "provider_init_failed", { provider: entry.name, error: err.message });
    }
  }

  const ordered = order.split(",").map(s => s.trim());
  const result = [];
  for (const name of ordered) {
    if (available.has(name)) result.push(available.get(name));
  }

  log("debug", "registry", "providers_loaded_v3", { order, count: result.length });
  return result;
}
