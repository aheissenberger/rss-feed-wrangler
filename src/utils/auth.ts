import { createHmac } from "crypto";

/**
 * Generates HMAC-SHA256 hash of a URL with a secret
 */
export function generateHash(feedUrl: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(feedUrl)
    .digest("hex")
    .substring(0, 16); // Use first 16 chars for shorter token
}

/**
 * Validates if the provided hash matches the feed URL with the secret
 */
export function validateHash(
  feedUrl: string,
  providedHash: string,
  secret: string
): boolean {
  const expectedHash = generateHash(feedUrl, secret);
  return providedHash === expectedHash;
}

/**
 * Generates query string with feedUrl and hash
 */
export function generateQueryString(
  feedUrl: string,
  secret: string
): string {
  const hash = generateHash(feedUrl, secret);
  return `feedUrl=${encodeURIComponent(feedUrl)}&hash=${encodeURIComponent(hash)}`;
}
