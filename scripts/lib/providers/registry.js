import { MimoProvider } from "./mimo.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { log } from "../logger.js";

/**
 * Provider 注册表 — 新增模型只需加一行
 * name:   用于 UNBLIND_PROVIDER_ORDER 排序
 * cls:    Provider 类（构造函数）
 * envKey: 决定是否创建的 env 变量名（存在即启用）
 * opts:   (key) => 构造函数额外参数
 */
const REGISTRY = [
  {
    name: "mimo",
    cls: MimoProvider,
    envKey: "MIMO_API_KEY",
    build: (apiKey, baseUrl, model, timeoutMs) =>
      new MimoProvider({ apiKey, baseUrl, model, timeoutMs }),
  },
  {
    name: "openai",
    cls: OpenAIProvider,
    envKey: "OPENAI_API_KEY",
    build: (apiKey, _baseUrl, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, model, timeoutMs }),
  },
  {
    name: "ollama",
    cls: OpenAIProvider,
    envKey: "OLLAMA_BASE_URL",
    build: (apiKey, url, model, timeoutMs) =>
      new OpenAIProvider({ apiKey: "ollama", baseUrl: url, model, timeoutMs }),
  },
  {
    name: "gemini",
    cls: GeminiProvider,
    envKey: "GEMINI_API_KEY",
    build: (apiKey, _url, model, timeoutMs) =>
      new GeminiProvider({ apiKey, baseUrl: process.env.GEMINI_BASE_URL || "", model: process.env.GEMINI_MODEL || model || "gemini-2.5-flash", timeoutMs }),
  },
  {
    name: "groq",
    cls: OpenAIProvider,
    envKey: "GROQ_API_KEY",
    build: (apiKey, _url, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1", model: process.env.GROQ_MODEL || "llama-4-vision", timeoutMs }),
  },
  {
    name: "together",
    cls: OpenAIProvider,
    envKey: "TOGETHER_API_KEY",
    build: (apiKey, _url, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, baseUrl: process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1", model: process.env.TOGETHER_MODEL || "Llama-4-Maverick", timeoutMs }),
  },
  {
    name: "fireworks",
    cls: OpenAIProvider,
    envKey: "FIREWORKS_API_KEY",
    build: (apiKey, _url, model, timeoutMs) =>
      new OpenAIProvider({ apiKey, baseUrl: process.env.FIREWORKS_BASE_URL || "https://api.fireworks.ai/inference/v1", model: process.env.FIREWORKS_MODEL || "llama-v4", timeoutMs }),
  },
];

/**
 * 加载已配置的 Provider，按 order 排序
 * @param {string} order - "mimo,openai,ollama"
 * @param {object} opts - { model, timeoutMs, baseUrls: {mimo, openai, ollama} }
 * @returns {Array<{provider, name}>}
 */
export function loadProviders(order, opts = {}) {
  const { model, timeoutMs, baseUrls = {} } = opts;
  const available = new Map();

  for (const entry of REGISTRY) {
    const key = process.env[entry.envKey] || "";
    if (!key) continue;
    available.set(entry.name, {
      provider: entry.build(key, baseUrls[entry.name] || "", model, timeoutMs),
      name: entry.name,
    });
  }

  const ordered = order.split(",").map(s => s.trim());
  const result = [];
  for (const name of ordered) {
    if (available.has(name)) result.push(available.get(name));
  }
  log("debug", "registry", "providers_loaded", { order, count: result.length });
  return result;
}
