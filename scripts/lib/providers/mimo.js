import { getBaseUrl, getAuthHeader } from "../credentialManager.js";
import { BaseProvider } from "./provider.js";
import { log } from "../logger.js";

export class MimoProvider extends BaseProvider {
  constructor({ apiKey, baseUrl, model = "mimo-v2.5", timeoutMs = 30_000 }) {
    super({ apiKey, model, timeoutMs });
    this._baseUrl = baseUrl || getBaseUrl(apiKey);
  }

  get name() { return "mimo"; }

  _buildRequest(image, prompt, options) {
    return {
      url: `${this._baseUrl}/v1/messages`,
      body: {
        model: this._model, max_tokens: options.maxSize || 2048,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: this._mime(image), data: this._b64(image) } },
          { type: "text", text: prompt }
        ]}]
      },
      headers: { "anthropic-version": "2023-06-01", ...getAuthHeader(this._apiKey) }
    };
  }

  async _parseResponse(res) {
    const data = await res.json();
    const tb = data.content?.find(c => c.type === "text");
    return tb?.text || JSON.stringify(data, null, 2);
  }

  _b64(d) { const i = d.indexOf(";base64,"); return i >= 0 ? d.slice(i + 8) : d; }
  _mime(d) { const m = d.match(/^data:(.+?);base64,/); return m ? m[1] : "image/png"; }
}
log("debug", "mimo", "module_loaded");
