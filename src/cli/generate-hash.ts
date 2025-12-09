import { generateQueryString } from "../utils/auth.ts";

/**
 * CLI tool to generate authenticated feed URLs
 * Usage: node --experimental-strip-types src/cli/generate-hash.ts <feed-url> [secret]
 */

const feedUrl = process.argv[2];
const secret = process.env.FEED_SECRET || process.argv[3];

if (!feedUrl) {
  console.error("Usage: generate-hash <feed-url> [secret]");
  console.error("  Environment variable: FEED_SECRET");
  process.exit(1);
}

if (!secret) {
  console.error("Error: Secret not provided");
  console.error("Set FEED_SECRET environment variable or pass as second argument");
  process.exit(1);
}

try {
  new URL(feedUrl);
} catch {
  console.error("Error: Invalid URL format");
  process.exit(1);
}

const queryString = generateQueryString(feedUrl, secret);

if (process.env.API_URL) {
  console.log(`${process.env.API_URL}?${queryString}`);
} else {
  console.log(`?${queryString}`);
}
