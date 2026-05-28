import { BaseProvider } from "./provider.js";
import { log } from "../logger.js";

export class OpenAIProvider extends BaseProvider {
  constructor({ apiKey, baseUrl = "https://api.openai.com/v1", model = "gpt-4o", timeoutMs = 30_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl;
  }

  get name() { return "openai"; }

  _buildRequest(image, prompt, options) {
    return {
      url: `${this._baseUrl}/chat/completions`,
      body: {
        model: this._model, max_tokens: options.maxSize || 2048,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: image } },
          { type: "text", text: prompt }
        ]}]
      },
      headers: { "Authorization": `Bearer ${this._apiKey}` }
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    return data.choices?.[0]?.message?.content || JSON.stringify(data);
  }
}
log("debug", "openai", "module_loaded");
