# RSS Feed Wrangler - Atom Feed Processor

AWS Lambda function behind API Gateway that processes Atom feeds and splits descriptions into summary and content.

## Features

- **Atom Feed Processing**: Accepts Atom feed URLs via API Gateway GET requests
- **Smart Paragraph Splitting**: Automatically detects and splits descriptions at the first paragraph
  - Handles HTML `<p>` tags
  - Falls back to `\n\n` newline delimiters
  - Supports mixed content formats
- **Content Type Detection**: Automatically detects plain text, HTML, or XHTML content
- **RFC 4287 Compliant**: Output feeds comply with Atom Feed specification

## Architecture

```
API Gateway (GET /feed?feedUrl=...)
    ↓
Lambda Function (Node.js 24)
    ├── Fetch Atom feed from URL
    ├── Parse XML with xml2js
    ├── Split each entry's summary at first paragraph
    ├── Move second part to <atom:content type="html">
    └── Return modified Atom XML
```

## Prerequisites

- Node.js 24.x or later (for `--experimental-strip-types` support)
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS credentials configured locally
- pnpm (recommended) or npm

## Installation

```bash
pnpm install
```

## Development

```bash
# Build TypeScript
pnpm build

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Synthesize CloudFormation template
pnpm synth

# View changes before deploying
pnpm diff
```

## Deployment

### Quick Start

```bash
# 1. Create .env.local file with your secret (gitignored)
echo "FEED_SECRET=your-very-secret-key-here" > .env.local

# 2. Deploy to AWS (automatically reads .env.local via cdk.json)
pnpm run deploy

# 3. Destroy the stack when needed
pnpm destroy
```

The CDK app automatically loads environment variables from `.env.local` via Node's `--env-file-if-exists` flag (configured in `cdk.json`).

### AWS Secrets Manager (Production)

For production, use AWS Secrets Manager instead:

```typescript
// In src/stacks/rss-feed-stack.ts
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";

const secret = secretsmanager.Secret.fromSecretNameV2(
  this,
  "FeedSecret",
  "feed-api-secret"
);

environment: {
  FEED_SECRET: secret.secretValue.unsafeUnwrap(),
}
```

### Update Secret Post-Deployment

```bash
# Via AWS CLI
aws lambda update-function-configuration \
  --function-name FeedProcessorFunction \
  --environment Variables="{FEED_SECRET=new-secret,NODE_OPTIONS=--enable-source-maps}"

# Via AWS Console: Lambda → Configuration → Environment variables
```

## Usage

After deployment, you'll receive an API endpoint. The API requires HMAC-SHA256 authentication to prevent unauthorized usage.

### Generate Authenticated URLs

The `generate-hash` tool automatically:
- Reads `FEED_SECRET` from `.env.local`
- Fetches your deployed API endpoint from CloudFormation
- Generates a complete authenticated URL

```bash
# Ensure .env.local exists with FEED_SECRET
echo "FEED_SECRET=your-secret-key" > .env.local

# Generate full authenticated URL
pnpm generate-hash "https://example.com/feed.xml"
# Output: https://xxxxx.execute-api.region.amazonaws.com/prod/feed?feedUrl=...&hash=...

# Or pass secret as argument (overrides .env.local)
pnpm generate-hash "https://example.com/feed.xml" "your-secret-key"
```

### API Request

```bash
# Copy the full URL from generate-hash output
curl "$(pnpm -s generate-hash https://example.com/feed.xml)"
```

### Local Testing

Test the handler locally without deploying:

```bash
pnpm local "https://example.com/feed.xml"
```

### Authentication

The API uses HMAC-SHA256 to authenticate requests:
- **Secret**: Stored in `FEED_SECRET` environment variable (required for authentication)
- **Hash Parameter**: First 16 characters of HMAC-SHA256(feedUrl, secret)
- **Backward Compatible**: If `FEED_SECRET` is not set, hash validation is skipped

### Request Parameters

- `feedUrl` (required): URL-encoded URL to the Atom/RSS feed to process
- `hash` (required): HMAC-SHA256 hash of the feedUrl (see "Generate Query String" above)

### Response

Returns the processed Atom/RSS feed as XML with `Content-Type: application/atom+xml`.

Each entry in the feed will have:
- Original `<summary>` or `<description>` trimmed to first paragraph only (HTML tags stripped)
- New `<content>` or `<content:encoded>` containing the remaining text with HTML preserved in CDATA (if present)

## Example

**Input Atom Entry:**
```xml
<entry>
  <summary>&lt;p&gt;First paragraph with some text.&lt;/p&gt;

&lt;p&gt;Second paragraph with more content.&lt;/p&gt;

&lt;p&gt;Third paragraph with even more details.&lt;/p&gt;</summary>
</entry>
```

**Output:**
```xml
<entry>
  <summary>First paragraph with some text.</summary>
  <content type="html"><![CDATA[<p>Second paragraph with more content.</p>

<p>Third paragraph with even more details.</p>]]></content>
</entry>
```

## Testing

Run the test suite:

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

All 90 tests pass in ~5 seconds including:
- Auth/HMAC generation and validation
- Parameter validation
- Hash verification
- Feed processing (Atom and RSS)
- Error handling
- URL edge cases


**Output Atom Entry:**
```xml
<entry>
  <summary>First paragraph with some text.</summary>
  <content type="html">Second paragraph with more content.

Third paragraph with even more details.</content>
</entry>
```

## Configuration

The Lambda function is configured with:
- **Timeout**: 30 seconds
- **Memory**: 512 MB
- **Runtime**: Node.js 24.x
- **Bundling**: Local esbuild (no Docker required)
- **Environment**: `FEED_SECRET` for HMAC authentication

## API Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing feedUrl parameter | Query parameter not provided |
| 400 | Invalid feedUrl | URL format is invalid |
| 403 | Invalid or missing hash | HMAC authentication failed |
| 500 | Failed to fetch feed | Network error or HTTP error from feed source |
| 500 | Failed to process feed | XML parsing error or other processing issue |

## Stack Outputs

After deployment, the following values are exported:
- **ApiEndpoint**: Base API Gateway URL
- **FeedEndpoint**: Full endpoint for feed processing (`/feed` resource)
- **LambdaFunctionArn**: Lambda function ARN

Retrieve outputs with:
```bash
aws cloudformation describe-stacks \
  --stack-name RssFeedWranglerStack \
  --query 'Stacks[0].Outputs' \
  --output table
```

## Project Structure

```
.
├── bin/
│   └── app.ts                       # CDK app entry point
├── src/
│   ├── cli/
│   │   ├── generate-hash.ts         # CLI tool for generating authenticated URLs
│   │   └── local-handler.ts         # Local testing wrapper
│   ├── handlers/
│   │   ├── feed-handler.ts          # Lambda handler function
│   │   └── feed-handler.test.ts     # Handler tests
│   ├── stacks/
│   │   └── rss-feed-stack.ts        # CDK stack definition
│   └── utils/
│       ├── auth.ts                  # HMAC authentication utilities
│       ├── auth.test.ts             # Auth tests
│       ├── feed-processor.ts        # Feed processing logic
│       ├── feed-processor.test.ts   # Feed processor tests
│       ├── text-splitter.ts         # Paragraph splitting utilities
│       └── text-splitter.test.ts    # Text splitter tests
├── cdk.json                         # CDK configuration
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
