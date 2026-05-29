#!/usr/bin/env node
import { resolve } from "path";
import { analyze, runHealthCheck } from "./lib/orchestrator.js";
import { formatError } from "./lib/errorHandler.js";
import { loadConfig, saveConfig } from "./lib/config.js";
import { getStats, clear } from "./lib/cache.js";
import { VALID_MODES } from "./lib/providers/provider.js";

const VALID_MODELS = ["mimo-v2.5", "mimo-v2-omni"];

function usage() {
  console.log(`Usage:
  node unblind.mjs <image-path> [mode]              分析图片
  node unblind.mjs <img1> <img2> [...更多图片] [mode]  分析/对比图片
  node unblind.mjs --health                          健康检查
  node unblind.mjs --config                          查看当前配置
  node unblind.mjs --set-model <model>               切换视觉模型

Modes:
  describe     (default) 图片描述
  ocr          文字提取
  ui-review    UI/UX 设计评审
  chart-data   图表数据提取
  object-detect 物体识别
  compare      多图对比分析（需 ≥2 张图）

Options:
  --no-cache   跳过缓存，强制执行 API 调用
  --format <json|yaml|csv>  指定输出格式（追加格式指令到 prompt）

Available models:
  mimo-v2.5    100/200 credits（默认，推荐）
  mimo-v2-omni 280/1400 credits`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);

  // --health
  if (args.includes("--health")) {
    const result = await runHealthCheck();
    console.log(result.healthy ? "✅ 健康检查通过" : "❌ 健康检查失败");
    console.log("");
    for (const check of result.checks) {
      const icon = check.pass ? "✅" : "❌";
      console.log(`${icon} ${check.name}: ${check.detail}`);
    }
    process.exit(result.healthy ? 0 : 1);
  }

  // --cache-stats
  if (args.includes("--cache-stats")) {
    const stats = await getStats();
    console.log("缓存统计:");
    console.log(`  缓存条目: ${stats.size}`);
    console.log(`  命中次数: ${stats.hits}`);
    console.log(`  未命中次数: ${stats.misses}`);
    process.exit(0);
  }

  // --clear-cache
  if (args.includes("--clear-cache")) {
    await clear();
    console.log("缓存已清除");
    process.exit(0);
  }

  // --config
  if (args.includes("--config")) {
    const cfg = loadConfig();
    console.log("当前配置:");
    console.log("  配置文件: ~/.claude/settings.json");
    console.log(`  视觉模型: ${cfg.model}`);
    console.log(`  API Key:  ${cfg.apiKey ? cfg.apiKey.slice(0, 3) + "***" : "未设置"}`);
    console.log(`  Base URL: ${cfg.baseUrl || "自动检测"}`);
    console.log(`  图片上限: ${(cfg.maxImageSize / 1024 / 1024).toFixed(0)}MB`);
    console.log(`  缓存 TTL: ${cfg.cacheTTLSeconds}s`);
    console.log(`  重试次数: ${cfg.retry.maxAttempts}`);
    console.log(`  超时时间: ${cfg.requestTimeoutMs / 1000}s`);
    process.exit(0);
  }

  // --set-model <model>
  const modelIdx = args.indexOf("--set-model");
  if (modelIdx >= 0) {
    const model = args[modelIdx + 1];
    if (!model || !VALID_MODELS.includes(model)) {
      console.error(`无效模型: ${model || "未指定"}`);
      console.error(`可用模型: ${VALID_MODELS.join(", ")}`);
      process.exit(1);
    }
    saveConfig({ MIMO_VISION_MODEL: model });
    console.log(`已切换到 ${model}。下次识图生效。`);
    process.exit(0);
  }

  const flags = args.filter(a => a.startsWith("--"));
  const positional = args.filter(a => !a.startsWith("--"));
  const cfg = loadConfig();

  let imagePaths, mode;
  if (positional.length > 1 && VALID_MODES.includes(positional[positional.length - 1])) {
    mode = positional[positional.length - 1];
    imagePaths = positional.slice(0, -1).map(p => resolve(p));
  } else {
    mode = cfg.defaultMode || "describe";
    imagePaths = positional.map(p => resolve(p));
  }

  if (imagePaths.length === 0) usage();
  if (mode === "compare" && imagePaths.length < 2) {
    console.error("compare 模式需要至少 2 张图片");
    process.exit(1);
  }

  const skipCache = flags.includes("--no-cache");
  const formatIdx = args.indexOf("--format");
  const format = formatIdx >= 0 ? (args[formatIdx + 1] || "").toLowerCase() : "";
  const validFormats = ["json", "yaml", "csv"];
  if (format && !validFormats.includes(format)) {
    console.warn(`未知格式: ${format}，将使用默认纯文本输出。支持: ${validFormats.join(", ")}`);
  }

  try {
    const result = await analyze(imagePaths, mode, { skipCache, format });
    console.log(result);
  } catch (err) {
    console.error(formatError(err));
    process.exit(1);
  }
}

main();
