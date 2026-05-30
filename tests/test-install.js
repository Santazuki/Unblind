import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

describe("install.sh", () => {
  // 验证部署文件列表与实际源文件一致
  it("should reference only files that exist in dev", () => {
    const script = readFileSync(join(ROOT, "install.sh"), "utf8");

    // install.sh 应该引用这些源文件
    const mustReference = ["SKILL.md", "README.md", "scripts/unblind.mjs"];
    for (const f of mustReference) {
      assert.ok(script.includes(f), `install.sh must reference: ${f}`);
    }

    // 不应该引用已删除的文件
    const mustNotRef = ['scripts/imageProcessor.js']; // 已移入 lib/
    for (const f of mustNotRef) {
      assert.ok(!script.includes(`cp "$SOURCE_DIR/${f}"`), `Must not reference deleted: ${f}`);
    }
  });

  it("should run syntax check (bash -n)", () => {
    execSync(`bash -n "${join(ROOT, "install.sh")}"`, {
      encoding: "utf8", timeout: 5000,
    });
  });

  it("should deploy to a temp dir", () => {
    const fakeHome = join(tmpdir(), "unblind-test-home")
      .replace(/\\/g, "/");

    // 使用 bash 作为 shell（Windows 需要显式指定）
    execSync(`mkdir -p "${fakeHome}/.claude"`, {
      encoding: "utf8", timeout: 3000, shell: "bash",
    });

    const out = execSync(
      `HOME="${fakeHome}" bash "${join(ROOT, "install.sh").replace(/\\/g, "/")}"`,
      { encoding: "utf8", timeout: 15000, cwd: ROOT, shell: "bash" },
    );
    assert.ok(out.includes("已部署"), `install.sh should complete. Got: ${out.slice(0, 300)}`);

    const skill = `${fakeHome}/.claude/skills/unblind`;

    // 核心运行时文件必须存在（最少验证）
    ["SKILL.md", "scripts/unblind.mjs", "scripts/lib/providers/registry.js"]
      .forEach(f => {
        assert.ok(existsSync(`${skill}/${f}`), `Must exist: ${f}`);
      });

    // 不应部署开发文件
    ["CLAUDE.md", "docs/", "tests/"]
      .forEach(f => {
        assert.ok(!existsSync(`${skill}/${f}`), `Must NOT exist: ${f}`);
      });

    // 无旧版根目录残留
    assert.ok(!existsSync(`${skill}/unblind.mjs`), "No stale root unblind.mjs");
  });
});

describe("install.js", () => {
  it("should be syntactically valid", () => {
    execSync(`node --check "${join(ROOT, "scripts", "install.js")}"`, {
      encoding: "utf8", timeout: 5000,
    });
  });

  it("should exist in dev directory", () => {
    assert.ok(existsSync(join(ROOT, "scripts", "install.js")),
      "install.js must exist");
  });

  it("FILES_TO_COPY should not include deleted files", () => {
    const content = readFileSync(join(ROOT, "scripts", "install.js"), "utf8");
    // 不应引用旧的根目录 unblind.mjs
    const hasRootUnblind = content.includes('"unblind.mjs"') &&
      !content.includes('"scripts/unblind.mjs"');
    assert.ok(!hasRootUnblind, "Should reference scripts/unblind.mjs, not root unblind.mjs");
  });
});
