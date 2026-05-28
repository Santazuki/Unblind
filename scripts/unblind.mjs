#!/usr/bin/env node
import { analyze } from "./lib/orchestrator.js";
import { formatError } from "./lib/errorHandler.js";

function usage() {
  console.log(`Usage: node unblind.mjs <image-path> [mode]

Modes:
  describe     (default) Detailed image description
  ocr          Extract all text from image
  ui-review    UI/UX design critique
  chart-data   Extract data from charts/graphs
  object-detect List objects, people, activities

Env vars:
  MIMO_API_KEY       Required — Token Plan (tp-*) or Balance (sk-*)
  MIMO_BASE_URL      Auto-detected from key type, override if needed
  MIMO_VISION_MODEL  Default: mimo-v2.5`);
  process.exit(1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) usage();

  const imagePath = args[0];
  const mode = args[1] || "describe";

  try {
    const result = await analyze(imagePath, mode);
    console.log(result);
  } catch (err) {
    console.error(formatError(err));
    process.exit(1);
  }
}

main();
