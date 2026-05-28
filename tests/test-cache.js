import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getCacheKey, get, set, invalidate, getStats, clear } from "../scripts/lib/cache.js";

describe("cache", () => {
  beforeEach(async () => {
    await clear();
  });

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
    it("should return cached value after set", async () => {
      await set("key1", "cached result", 60);
      assert.equal(await get("key1"), "cached result");
    });

    it("should return null for missing key", async () => {
      assert.equal(await get("nonexistent"), null);
    });

    it("should return null for expired entry", async () => {
      await set("key2", "expired", 0); // 0s TTL
      // 文件持久化需要等待 mtime 落地，同时确保 Date.now() 超过 expiresAt
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(await get("key2"), null);
    });

    it("should respect custom TTL", async () => {
      await set("key3", "short-lived", 1);
      assert.equal(await get("key3"), "short-lived");
      await new Promise((r) => setTimeout(r, 1100));
      assert.equal(await get("key3"), null);
    });
  });

  describe("invalidate", () => {
    it("should remove a cached entry", async () => {
      await set("key4", "value", 60);
      await invalidate("key4");
      assert.equal(await get("key4"), null);
    });
  });

  describe("getStats", () => {
    it("should track hits and misses", async () => {
      await clear();
      await get("not-there");
      assert.equal((await getStats()).misses, 1);
      await set("hit-key", "val", 60);
      await get("hit-key");
      assert.equal((await getStats()).hits, 1);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await set("a", "1", 60);
      await set("b", "2", 60);
      await clear();
      assert.equal(await get("a"), null);
      assert.equal(await get("b"), null);
    });
  });
});
