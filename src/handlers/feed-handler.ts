import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { fetchAndProcessFeed } from "../utils/feed-processor.ts";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    // Extract feedUrl from query parameters
    const feedUrl = event.queryStringParameters?.feedUrl;

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
