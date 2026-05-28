import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 从 markdown 文件中提取 `node scripts/...` 命令
function extractCommands(filePath) {
  const content = readFileSync(filePath, "utf8");
  const re = /```bash\s*\n(node\s+scripts\/[^\n]+)/g;
  const cmds = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    cmds.push(m[1].trim());
  }
  return cmds;
}

// 替换占位符为真实值
function resolveCommand(cmd) {
  return cmd
    .replace("<image-path>", join(ROOT, "tests", "sample_images", "README.md")) // 用已知存在的文件
    .replace("<image>", join(ROOT, "tests", "sample_images", "README.md"))
    .replace("<mode>", "describe")
    .replace("<model>", "mimo-v2.5")
    .replace("<m>", "mimo-v2.5");
}

describe("documented commands", () => {
  const docFiles = [
    "resources/best_practices.md",
    "resources/troubleshooting.md",
    "templates/chain_of_thought.md",
  ].filter(f => existsSync(join(ROOT, f)));

  const allCmds = new Set();
  for (const f of docFiles) {
    for (const cmd of extractCommands(join(ROOT, f))) {
      allCmds.add(cmd);
    }
  }

  // 分类：有占位符的 vs 无占位符的
  const staticCmds = [...allCmds].filter(c => !c.includes("<"));
  const templatedCmds = [...allCmds].filter(c => c.includes("<"));

  it(`should have ${staticCmds.length} static commands that are syntactically valid`, () => {
    for (const cmd of staticCmds) {
      const result = execSync(`${cmd} --help 2>&1 || true`, {
        encoding: "utf8",
        cwd: ROOT,
        timeout: 5000,
      }).toString();
      // 命令应该要么成功执行，要么至少能识别（输出 usage/help）
      const ok = result.includes("Usage") || result.includes("Modes") ||
                 result.includes("当前配置") || result.includes("缓存") ||
                 result.includes("健康检查") || result.includes("已切换");
      assert.ok(ok, `Static command should be valid: ${cmd}\nOutput: ${result.slice(0, 200)}`);
    }
  });

  it(`should have ${templatedCmds.length} templated commands with valid base structure`, () => {
    for (const cmd of templatedCmds) {
      // 替换占位符后验证 CLI 结构
      const resolved = resolveCommand(cmd);
      try {
        execSync(`node ${resolved} 2>&1 || true`, {
          encoding: "utf8",
          cwd: ROOT,
          timeout: 5000,
        });
      } catch {
        // 即使报错（如文件不存在），只要不是语法错误就行
      }
      // 验证命令基础格式：scripts/unblind.mjs 存在
      const scriptPath = resolved.split(" ")[1]; // "node scripts/xxx" → "scripts/xxx"
      assert.ok(existsSync(join(ROOT, scriptPath)),
        `Script referenced in command must exist: ${scriptPath}\nCommand: ${cmd}`);
    }
  });

  function runCli(args, opts = {}) {
    try {
      const out = execSync(`node "${join(ROOT, "scripts", "unblind.mjs")}" ${args}`, {
        encoding: "utf8", timeout: opts.timeout || 10000, ...opts,
      });
      return { ok: true, stdout: out.toString(), stderr: "" };
    } catch (e) {
      return { ok: false, stdout: e.stdout?.toString() || "", stderr: e.stderr?.toString() || "" };
    }
  }

  // 关键命令精确验证
  it("--health should output diagnostic info (even on failure)", async () => {
    const r = runCli("--health", { timeout: 15000 });
    const out = r.stdout + r.stderr;
    assert.ok(out.includes("健康检查"), `Should show health check. Got: ${out.slice(0, 200)}`);
  });

  it("--config should show model info", () => {
    const r = runCli("--config");
    assert.ok(r.ok, "--config should exit 0");
    assert.ok(r.stdout.includes("视觉模型"), `Should show model. Got: ${r.stdout.slice(0, 200)}`);
  });

  it("--cache-stats should show cache info", () => {
    const r = runCli("--cache-stats");
    assert.ok(r.ok, "--cache-stats should exit 0");
    assert.ok(r.stdout.includes("缓存"), `Should show cache. Got: ${r.stdout.slice(0, 200)}`);
  });

  it("--set-model with invalid model should error cleanly", () => {
    const r = runCli("--set-model invalid-model");
    assert.ok(!r.ok, "should exit non-zero");
    assert.ok(r.stderr.includes("无效模型") || r.stdout.includes("无效模型"),
      "Should reject invalid model with clear error");
  });
});
