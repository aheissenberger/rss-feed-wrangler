import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  generateHash,
  validateHash,
  generateQueryString,
} from "./auth.ts";

test("Auth utilities - HMAC generation", async (t) => {
  await t.test("should generate consistent hash for same input", () => {
    const url = "https://example.com/feed.xml";
    const secret = "my-secret";

    const hash1 = generateHash(url, secret);
    const hash2 = generateHash(url, secret);

    assert.equal(hash1, hash2);
  });

  await t.test("should generate different hash for different URLs", () => {
    const secret = "my-secret";
    const hash1 = generateHash("https://example1.com/feed.xml", secret);
    const hash2 = generateHash("https://example2.com/feed.xml", secret);

    assert.notEqual(hash1, hash2);
  });

  await t.test("should generate different hash for different secrets", () => {
    const url = "https://example.com/feed.xml";
    const hash1 = generateHash(url, "secret1");
    const hash2 = generateHash(url, "secret2");

    assert.notEqual(hash1, hash2);
  });

  await t.test("should generate 16-character hash", () => {
    const hash = generateHash("https://example.com/feed.xml", "secret");
    assert.equal(hash.length, 16);
  });

  await t.test("should generate hexadecimal hash", () => {
    const hash = generateHash("https://example.com/feed.xml", "secret");
    assert.ok(/^[0-9a-f]{16}$/.test(hash));
  });
});

test("Auth utilities - Hash validation", async (t) => {
  await t.test("should validate correct hash", () => {
    const url = "https://example.com/feed.xml";
    const secret = "my-secret";
    const hash = generateHash(url, secret);

    const isValid = validateHash(url, hash, secret);
    assert.ok(isValid);
  });

  await t.test("should reject invalid hash", () => {
    const url = "https://example.com/feed.xml";
    const secret = "my-secret";
    const wrongHash = "0000000000000000";

    const isValid = validateHash(url, wrongHash, secret);
    assert.equal(isValid, false);
  });

  await t.test("should reject hash for different URL", () => {
    const secret = "my-secret";
    const hash = generateHash("https://example1.com/feed.xml", secret);

    const isValid = validateHash(
      "https://example2.com/feed.xml",
      hash,
      secret
    );
    assert.equal(isValid, false);
  });

  await t.test("should reject hash with different secret", () => {
    const url = "https://example.com/feed.xml";
    const hash = generateHash(url, "secret1");

    const isValid = validateHash(url, hash, "secret2");
    assert.equal(isValid, false);
  });
});

test("Auth utilities - Query string generation", async (t) => {
  await t.test("should generate valid query string", () => {
    const url = "https://example.com/feed.xml";
    const secret = "my-secret";

    const queryString = generateQueryString(url, secret);

    assert.ok(queryString.includes("feedUrl="));
    assert.ok(queryString.includes("hash="));
    assert.ok(queryString.includes("https%3A%2F%2Fexample.com%2Ffeed.xml"));
  });

  await t.test("should contain valid hash in query string", () => {
    const url = "https://example.com/feed.xml";
    const secret = "my-secret";

    const queryString = generateQueryString(url, secret);
    const hashMatch = queryString.match(/hash=([a-f0-9]{16})/);

    assert.ok(hashMatch);
    const hash = hashMatch![1];
    assert.ok(validateHash(url, hash, secret));
  });

  await t.test("should URL-encode special characters in query string", () => {
    const url = "https://example.com/feed.xml?category=tech&sort=date";
    const secret = "my-secret";

    const queryString = generateQueryString(url, secret);

    // Query string should be properly encoded
    assert.ok(queryString.includes("%3F")); // ?
    assert.ok(queryString.includes("%26")); // &
  });
});
