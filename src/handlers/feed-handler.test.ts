import { test } from "node:test";
import { strict as assert } from "node:assert";
import { handler } from "./feed-handler.ts";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

// Mock fetch for fast tests
const originalFetch = global.fetch;

interface MockFetchOptions {
  ok?: boolean;
  status?: number;
  statusText?: string;
  text?: string;
  throwError?: boolean;
}

const mockFetch = (url: string, options?: MockFetchOptions) => {
  const mockOptions = options || {};
  
  if (mockOptions.throwError) {
    return Promise.reject(new Error("Network error"));
  }

  return Promise.resolve({
    ok: mockOptions.ok !== false,
    status: mockOptions.status || 200,
    statusText: mockOptions.statusText || "OK",
    text: async () =>
      mockOptions.text ||
      `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><summary>Test</summary></entry></feed>`,
  });
};

// Helper to create mock API Gateway event
const createMockEvent = (feedUrl?: string): APIGatewayProxyEventV2 => {
  const queryStringParameters = feedUrl ? { feedUrl } : undefined;

  return {
    version: "2.0",
    routeKey: "GET /feed",
    rawPath: "/feed",
    rawQueryString: feedUrl ? `feedUrl=${encodeURIComponent(feedUrl)}` : "",
    headers: {
      host: "example.com",
      "user-agent": "test-client",
      "content-type": "application/json",
    },
    queryStringParameters,
    requestContext: {
      http: {
        method: "GET",
        path: "/feed",
        protocol: "HTTP/1.1",
        sourceIp: "192.168.1.1",
        userAgent: "test-client",
      },
      routeKey: "GET /feed",
      stage: "$default",
      accountId: "123456789012",
      apiId: "api-id",
      domainName: "example.com",
      domainPrefix: "api",
      requestId: "test-request-id",
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    isBase64Encoded: false,
  };
};

test("Lambda Handler - Parameter validation", async (t) => {
  await t.test("should return 400 when feedUrl parameter is missing", async () => {
    const event = createMockEvent();
    const response = await handler(event);

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.equal(responseValue.statusCode, 400);
    assert.equal(
      responseValue.headers?.["Content-Type"],
      "application/json"
    );

    const body = JSON.parse(responseValue.body as string);
    assert.ok(body.error.includes("feedUrl"));
  });

  await t.test(
    "should return 400 when feedUrl is not a valid URL",
    async () => {
      const event = createMockEvent("not-a-valid-url");
      const response = await handler(event);

      const responseValue = typeof response === "string" ? JSON.parse(response) : response;
      assert.equal(responseValue.statusCode, 400);

      const body = JSON.parse(responseValue.body as string);
      assert.ok(body.error.includes("Invalid feedUrl"));
    }
  );

  await t.test("should accept valid HTTP URLs", async () => {
    global.fetch = mockFetch as any;
    const event = createMockEvent("http://example.com/feed.xml");
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // Should not be a 400 parameter validation error
    assert.notEqual(responseValue.statusCode, 400);
  });

  await t.test("should accept valid HTTPS URLs", async () => {
    global.fetch = mockFetch as any;
    const event = createMockEvent("https://example.com/feed.xml");
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // Should not be a 400 parameter validation error
    assert.notEqual(responseValue.statusCode, 400);
  });
});

test("Lambda Handler - Response headers", async (t) => {
  await t.test(
    "should set correct content-type for error responses",
    async () => {
      const event = createMockEvent();
      const response = await handler(event);

      const responseValue = typeof response === "string" ? JSON.parse(response) : response;
      assert.equal(
        responseValue.headers?.["Content-Type"],
        "application/json"
      );
    }
  );

  await t.test("should handle network errors gracefully", async () => {
    global.fetch = ((url: string) =>
      Promise.reject(new Error("Network error"))) as any;
    const event = createMockEvent(
      "http://this-domain-does-not-exist-12345.invalid/feed.xml"
    );
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.equal(responseValue.statusCode, 500);

    const body = JSON.parse(responseValue.body as string);
    assert.ok(body.error);
    assert.ok(body.details);
  });
});

test("Lambda Handler - Error handling", async (t) => {
  await t.test("should return 500 for network errors", async () => {
    global.fetch = ((url: string) =>
      Promise.reject(new Error("Network error"))) as any;
    const event = createMockEvent(
      "http://invalid-url-that-will-fail.test/feed.xml"
    );
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.equal(responseValue.statusCode, 500);

    const body = JSON.parse(responseValue.body as string);
    assert.equal(body.error, "Failed to process feed");
    assert.ok(body.details);
  });

  await t.test("should include error details in response", async () => {
    global.fetch = ((url: string) =>
      Promise.reject(new Error("Connection refused"))) as any;
    const event = createMockEvent("http://localhost:0/feed.xml");
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.equal(responseValue.statusCode, 500);

    const body = JSON.parse(responseValue.body as string);
    assert.ok(body.error);
    assert.ok(body.details);
  });
});

test("Lambda Handler - Successful feed processing mock", async (t) => {
  await t.test(
    "should structure response correctly on successful processing",
    async () => {
      global.fetch = mockFetch as any;
      const event = createMockEvent("http://localhost:3000/test-feed.xml");
      const response = await handler(event);
      global.fetch = originalFetch;

      const responseValue = typeof response === "string" ? JSON.parse(response) : response;
      // Response should be properly structured
      assert.ok(responseValue.statusCode);
      assert.ok(responseValue.body);
      assert.ok(responseValue.headers);
    }
  );
});

test("Lambda Handler - Parameter edge cases", async (t) => {
  await t.test("should handle URL with query parameters", async () => {
    global.fetch = mockFetch as any;
    const url = "https://example.com/feed.xml?category=tech&format=atom";
    const event = createMockEvent(url);
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // Should validate as proper URL (not return 400)
    assert.notEqual(responseValue.statusCode, 400);
  });

  await t.test("should handle URL with fragment identifier", async () => {
    global.fetch = mockFetch as any;
    const url = "https://example.com/feed.xml#section1";
    const event = createMockEvent(url);
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // Should validate as proper URL
    assert.notEqual(responseValue.statusCode, 400);
  });

  await t.test("should handle URL with authentication", async () => {
    global.fetch = ((url: string) =>
      Promise.reject(new Error("Credentials not allowed"))) as any;
    const url = "https://user:pass@example.com/feed.xml";
    const event = createMockEvent(url);
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // URL validation should pass, fetch may fail
    assert.ok(responseValue);
  });

  await t.test("should handle URL with port number", async () => {
    global.fetch = mockFetch as any;
    const url = "https://example.com:8443/feed.xml";
    const event = createMockEvent(url);
    const response = await handler(event);
    global.fetch = originalFetch;

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    // URL validation should pass
    assert.notEqual(responseValue.statusCode, 400);
  });
});

test("Lambda Handler - Response structure validation", async (t) => {
  await t.test("should always return statusCode in response", async () => {
    const event = createMockEvent();
    const response = await handler(event);

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.ok(typeof responseValue.statusCode === "number");
    assert.ok(responseValue.statusCode >= 100 && responseValue.statusCode < 600);
  });

  await t.test("should always return body in response", async () => {
    const event = createMockEvent();
    const response = await handler(event);

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.ok(responseValue.body);
    assert.ok(typeof responseValue.body === "string");
  });

  await t.test("should always return headers in response", async () => {
    const event = createMockEvent();
    const response = await handler(event);

    const responseValue = typeof response === "string" ? JSON.parse(response) : response;
    assert.ok(responseValue.headers);
    assert.ok(responseValue.headers["Content-Type"]);
  });
});
