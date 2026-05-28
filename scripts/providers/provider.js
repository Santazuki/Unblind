// Vision Provider 接口定义
// Phase 1 — 为多模型接入提供统一抽象
//
// interface IVisionProvider {
//   readonly name: string;
//   analyzeImage(params: AnalyzeParams): Promise<AnalyzeResult>;
//   healthCheck(): Promise<boolean>;
// }
//
// 已实现 Provider:
//   - MimoProvider     (mimo-v2.5 / mimo-v2-omni) — 当前主力
//
// 预留 Provider:
//   - DeepSeekVLProvider — DeepSeek VL 模型（待开放）
//   - OpenAIProvider     — GPT-4V 备选（需用户自备 Key）
//   - LocalProvider      — 本地 Ollama 模型（llava/moondream）
