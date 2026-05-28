import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { log, setLogLevel } from "../scripts/lib/logger.js";

describe("logger", () => {
  it("should output valid JSON Lines to stderr", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("debug");
    log("info", "test-module", "test_event", { key: "val" });

    process.stderr.write = orig;
    assert.ok(lines.length > 0, "should have written to stderr");
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.level, "info");
    assert.equal(parsed.module, "test-module");
    assert.equal(parsed.event, "test_event");
    assert.ok(parsed.timestamp);
    assert.equal(parsed.key, "val");
  });

  it("should filter by log level", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("warn");
    log("info", "test", "should_not_appear");
    log("error", "test", "should_appear");

    process.stderr.write = orig;
    assert.equal(lines.length, 1, "only error level should appear");
  });

  it("should handle undefined data", () => {
    const lines = [];
    const orig = process.stderr.write;
    process.stderr.write = (chunk) => { lines.push(chunk); return true; };

    setLogLevel("info");
    log("info", "test", "no_data");

    process.stderr.write = orig;
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.event, "no_data");
  });
});
