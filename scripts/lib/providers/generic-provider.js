// scripts/lib/providers/generic-provider.js

import { ClientError } from "../errorHandler.js";
import { apiRequest } from "../httpClient.js";
import { MODE_PROMPTS } from "./provider.js";

/** 允许 overrides 覆盖的方法 — 仅 buildBody 和 parseError */
const ALLOWED_OVERRIDES = ["buildBody", "parseError"];

/**
 * GenericProvider — 唯一 Provider 类，零子类
 *
 * 接收协议对象（纯函数集合），调度协议函数完成 API 请求。
 * 不含任何 API 特定的业务逻辑。
 *
 * 双接口：
 * - execute({inputs, prompt, options}) — 新主接口，类型无关
 * - analyzeImage({image, prompt, options}) — 旧接口，向后兼容
 */
export class GenericProvider {
  /**
   * @param {object} opts
   * @param {string} opts.name — Provider 名
   * @param {object} opts.protocol — 协议对象（含 6 个方法）
   * @param {string} opts.baseUrl — API 基地址
   * @param {string} opts.apiKey — API Key
   * @param {string} opts.model — 模型名
   * @param {number} [opts.timeoutMs=30000]
   * @param {object} [opts.overrides={}] — 方法覆盖（仅 buildBody/parseError）
   */
  constructor({ name, protocol, baseUrl, apiKey, model, timeoutMs = 30_000, overrides = {} }) {
    this.name = name;
    this._baseUrl = baseUrl;
    this._apiKey = apiKey;
    this._model = model;
    this._timeoutMs = timeoutMs;

    // 协议对象校验
    if (!protocol || typeof protocol !== "object") {
      throw new ClientError(`Provider "${name}": 协议无效，请传入协议对象`);
    }
    this._proto = protocol;

    // 校验 overrides
    this._validateOverrides(overrides);
    this._overrides = overrides;
  }

  /**
   * 校验 overrides：仅允许 ALLOWED_OVERRIDES 中的 key
   * 且值必须为函数，且对应方法在协议中存在
   */
  _validateOverrides(overrides) {
    for (const key of Object.keys(overrides)) {
      if (!ALLOWED_OVERRIDES.includes(key)) {
        throw new ClientError(
          `Provider "${this.name}": 不允许覆盖 "${key}"，仅允许 ${ALLOWED_OVERRIDES.join(", ")}`
        );
      }
      if (typeof overrides[key] !== "function") {
        throw new ClientError(
          `Provider "${this.name}": override "${key}" 必须是函数`
        );
      }
      if (typeof this._proto[key] !== "function") {
        throw new ClientError(
          `Provider "${this.name}": 协议没有方法 "${key}"，无法覆盖`
        );
      }
    }
  }

  /**
   * 调用协议方法（overrides 优先）
   * @param {string} method — 方法名
   * @param {...any} args
   * @returns {any}
   */
  _call(method, ...args) {
    if (this._overrides[method]) {
      return this._overrides[method](this._proto, ...args);
    }
    return this._proto[method](...args);
  }

  /**
   * 新主接口：类型无关的输入处理
   * @param {{ inputs: Array<{type:string, data:string, mimeType?:string}>,
   *           prompt: string, options?: object }} params
   * @returns {Promise<{ content: string, model: string, processingTimeMs: number }>}
   */
  async execute({ inputs, prompt, options = {} }) {
    const startTime = Date.now();

    const content = this._call("buildContent", inputs, prompt);
    const body = this._call("buildBody", this._model, content, options);
    const headers = this._call("auth", this._apiKey);
    const ep = this._proto.endpoint(this._model);

    const url = this._baseUrl ? `${this._baseUrl}${ep}` : ep;
    const res = await apiRequest(url, {
      body,
      headers,
      timeoutMs: this._timeoutMs,
      providerName: this.name,
      parseError: (data, status) => this._call("parseError", data, status),
    });

    const data = await res.json();
    const text = this._proto.extractContent(data);

    return {
      content: text,
      model: this._model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 向后兼容旧接口
   * 将 {image, prompt, options} 转换为 execute({inputs, prompt, options})
   */
  async analyzeImage({ image, prompt, options = {} }) {
    const imgs = Array.isArray(image) ? image : [image];
    const inputs = imgs.map(img => {
      if (typeof img === "string") {
        const mimeMatch = img.match(/^data:(.+?);base64,/);
        return { type: "image", data: img, mimeType: mimeMatch ? mimeMatch[1] : "image/png" };
      }
      return { type: "image", data: img.base64, mimeType: img.mimeType || "image/png" };
    });

    const mode = options.mode || "describe";
    const defaultPrompt = MODE_PROMPTS[mode] || "";
    const finalPrompt = prompt && prompt !== defaultPrompt ? prompt : defaultPrompt;

    return this.execute({
      inputs,
      prompt: finalPrompt,
      options: { maxTokens: options.maxSize, temperature: options.temperature },
    });
  }

  /**
   * 快速连通性检查
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const miniPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
      const result = await this.execute({
        inputs: [{ type: "image", data: miniPng, mimeType: "image/png" }],
        prompt: "say OK",
        options: { maxTokens: 50 },
      });
      return result.content.length > 0;
    } catch {
      return false;
    }
  }
}
