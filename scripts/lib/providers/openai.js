import { BaseProvider } from "./provider.js";
import { ClientError } from "../errorHandler.js";
import { log } from "../logger.js";

export class OpenAIProvider extends BaseProvider {
  constructor({ apiKey, baseUrl = "https://api.openai.com/v1", model = "gpt-4o", timeoutMs = 30_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl;
  }

  get name() { return "openai"; }

  _buildRequest(images, prompt, options) {
    const content = [];

    if (Array.isArray(images)) {
      // Multi-image: each element is { base64, mimeType }
      for (const img of images) {
        content.push({ type: "image_url", image_url: { url: img.base64 } });
      }
    } else {
      // Single image (backward-compatible)
      content.push({ type: "image_url", image_url: { url: images } });
    }

    content.push({ type: "text", text: prompt });

    return {
      url: `${this._baseUrl}/chat/completions`,
      body: {
        model: this._model, max_tokens: options.maxSize || 2048,
        messages: [{ role: "user", content }]
      },
      headers: { "Authorization": `Bearer ${this._apiKey}` }
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new ClientError("API 返回格式异常，未找到文本内容");
    return content;
  }
}
log("debug", "openai", "module_loaded");
