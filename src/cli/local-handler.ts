#!/usr/bin/env node
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { handler } from "../handlers/feed-handler.ts";
import { generateHash } from "../utils/auth.ts";

function parseFeedUrl(argv: string[]): string | undefined {
  let feedUrl: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--feedUrl" || arg === "-u") {
      feedUrl = argv[i + 1];
      i++;
      continue;
    }
    if (!arg.startsWith("-")) {
      feedUrl = arg;
    }
  }

  return feedUrl;
}

const feedUrl = parseFeedUrl(process.argv.slice(2));

if (!feedUrl) {
  console.error("Usage: node src/cli/local-handler.ts --feedUrl <URL>\n       node src/cli/local-handler.ts <URL>");
  process.exit(1);
}

// Generate hash for authentication (use local test secret if not set)
const secret = process.env.FEED_SECRET || "local-test-secret";
const hash = generateHash(feedUrl, secret);

const event: APIGatewayProxyEventV2 = {
  version: "2.0",
  routeKey: "GET /feed",
  rawPath: "/feed",
  rawQueryString: `feedUrl=${encodeURIComponent(feedUrl)}&hash=${encodeURIComponent(hash)}`,
  headers: {
    host: "localhost",
    "user-agent": "cli",
  },
  queryStringParameters: { feedUrl, hash },
  requestContext: {
    http: {
      method: "GET",
      path: "/feed",
      protocol: "HTTP/1.1",
      sourceIp: "127.0.0.1",
      userAgent: "cli",
    },
    routeKey: "GET /feed",
    stage: "local",
    accountId: "local",
    apiId: "local",
    domainName: "localhost",
    domainPrefix: "local",
    requestId: "local",
    time: new Date().toISOString(),
    timeEpoch: Date.now(),
  },
  isBase64Encoded: false,
};

try {
  const response = await handler(event);

  const responseValue = typeof response === "string" ? JSON.parse(response) : response;

  if (responseValue.statusCode && responseValue.statusCode >= 400) {
    console.error(`Error ${responseValue.statusCode}:`, responseValue.body);
    process.exit(1);
  }

  if (responseValue.body) {
    console.log(responseValue.body);
  }
} catch (error) {
  console.error("Handler threw:", error);
  process.exit(1);
}
