import { MimoProvider } from "./mimo.js";
import { OpenAIProvider } from "./openai.js";
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
