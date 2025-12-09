import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { fetchAndProcessFeed } from "../utils/feed-processor.ts";
import { validateHash } from "../utils/auth.ts";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Extract parameters from query string
    const feedUrl = event.queryStringParameters?.feedUrl;
    const hash = event.queryStringParameters?.hash;
    const secret = process.env.FEED_SECRET;

    if (!feedUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required query parameter: feedUrl",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    if (!hash) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Missing required query parameter: hash",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    // Validate URL format
    try {
      new URL(feedUrl);
    } catch {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Invalid feedUrl parameter - must be a valid URL",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    // Validate hash if secret is configured
    if (secret && !validateHash(feedUrl, hash, secret)) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: "Invalid hash - request not authorized",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      };
    }

    // Fetch and process the feed
    const processedFeed = await fetchAndProcessFeed(feedUrl);

    return {
      statusCode: 200,
      body: processedFeed,
      headers: {
        "Content-Type": "application/atom+xml; charset=utf-8",
        "Cache-Control": "max-age=3600",
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error processing feed";

    console.error("Feed processing error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to process feed",
        details: message,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
}
