import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

describe("version consistency", () => {
  it("package.json and SKILL.md versions should match", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    const skill = readFileSync(join(ROOT, "SKILL.md"), "utf8");
    const m = skill.match(/version:\s*"(\d+\.\d+(?:\.\d+)?)"/);
    assert.ok(m, "SKILL.md metadata must have version field");
    const skillVersion = m[1];

    // package.json 用 semver (2.2.0)，SKILL.md 用 MAJOR.MINOR (2.2)
    const pkgMajorMinor = pkg.version.split(".").slice(0, 2).join(".");
    assert.equal(pkgMajorMinor, skillVersion.split(".").slice(0, 2).join("."),
      `package.json (${pkg.version}) and SKILL.md (${skillVersion}) major.minor must match`);
  });

  it("SKILL.md version should follow semver format", () => {
    const skill = readFileSync(join(ROOT, "SKILL.md"), "utf8");
    const m = skill.match(/version:\s*"(\S+)"/);
    assert.ok(m, "SKILL.md must have version field");
    assert.ok(/^\d+\.\d+(?:\.\d+)?$/.test(m[1]),
      `version should be semver, got: ${m[1]}`);
  });
});
