import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getCacheKey, get, set, invalidate, getStats, clear } from "../scripts/lib/cache.js";

describe("cache", () => {
  beforeEach(() => clear());

  describe("getCacheKey", () => {
    it("should return a SHA256 hex string", () => {
      const key = getCacheKey("abc123", "describe prompt");
      assert.equal(key.length, 64);
    });

    it("should produce different keys for different hashes", () => {
      assert.notEqual(getCacheKey("hash1", "same"), getCacheKey("hash2", "same"));
    });

    it("should produce different keys for different prompts", () => {
      assert.notEqual(getCacheKey("same", "promptA"), getCacheKey("same", "promptB"));
    });
  });

  describe("get/set", () => {
    it("should return cached value after set", () => {
      set("key1", "cached result", 60);
      assert.equal(get("key1"), "cached result");
    });

    it("should return null for missing key", () => {
      assert.equal(get("nonexistent"), null);
    });

    it("should return null for expired entry", async () => {
      set("key2", "expired", 0); // 0s TTL
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(get("key2"), null);
    });

    it("should respect custom TTL", async () => {
      set("key3", "short-lived", 1);
      assert.equal(get("key3"), "short-lived");
      await new Promise((r) => setTimeout(r, 1100));
      assert.equal(get("key3"), null);
    });
  });

  describe("invalidate", () => {
    it("should remove a cached entry", () => {
      set("key4", "value", 60);
      invalidate("key4");
      assert.equal(get("key4"), null);
    });
  });

  describe("getStats", () => {
    it("should track hits and misses", () => {
      clear();
      get("not-there");
      assert.equal(getStats().misses, 1);
      set("hit-key", "val", 60);
      get("hit-key");
      assert.equal(getStats().hits, 1);
    });
  });

  describe("clear", () => {
    it("should remove all entries", () => {
      set("a", "1", 60);
      set("b", "2", 60);
      clear();
      assert.equal(get("a"), null);
      assert.equal(get("b"), null);
    });
  });
});
