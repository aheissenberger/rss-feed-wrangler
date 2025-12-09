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

- Node.js 24.x or later
- AWS CDK CLI (`npm install -g aws-cdk`)
- AWS credentials configured locally

## Installation

```bash
npm install
```

## Development

```bash
# Build TypeScript
npm run build

# Watch mode for development
npm run dev

# Synthesize CloudFormation template
npm run synth

# View changes before deploying
npm run diff
```

## Deployment

```bash
# Deploy to AWS (requires AWS credentials and permissions)
npm run deploy

# Destroy the stack
npm run destroy
```

## Usage

After deployment, you'll receive an API endpoint. Use it like:

```bash
# Basic usage
curl "https://YOUR_API_ENDPOINT/feed?feedUrl=https://example.com/atom.xml"

# With URL encoding
curl "https://YOUR_API_ENDPOINT/feed?feedUrl=https%3A%2F%2Fexample.com%2Fatom.xml"
```

### Request Parameters

- `feedUrl` (required): URL-encoded URL to the Atom feed to process

### Response

Returns the processed Atom feed as XML with `Content-Type: application/atom+xml`.

Each entry in the feed will have:
- Original `<atom:summary>` trimmed to first paragraph only
- New `<atom:content type="html">` containing the remaining text (if present)

## Example

**Input Atom Entry:**
```xml
<entry>
  <summary>First paragraph with some text.

Second paragraph with more content.

Third paragraph with even more details.</summary>
</entry>
```

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
- **Architecture**: ARM64 (Graviton2) for cost optimization

## API Errors

| Status | Error | Cause |
|--------|-------|-------|
| 400 | Missing feedUrl parameter | Query parameter not provided |
| 400 | Invalid feedUrl | URL format is invalid |
| 500 | Failed to fetch feed | Network error or HTTP error from feed source |
| 500 | Failed to process feed | XML parsing error or other processing issue |

## Stack Outputs

After deployment, the following values are exported:
- **AtomFeedApiEndpoint**: Base API Gateway URL
- **AtomFeedProcessorEndpoint**: Full endpoint for feed processing
- **FeedProcessorFunctionArn**: Lambda function ARN

## Project Structure

```
.
├── bin/
│   └── app.ts                    # CDK app entry point
├── src/
│   ├── handlers/
│   │   └── feed-handler.ts       # Lambda handler function
│   ├── stacks/
│   │   └── rss-feed-stack.ts     # CDK stack definition
│   └── utils/
│       ├── feed-processor.ts     # Feed processing logic
│       └── text-splitter.ts      # Paragraph splitting utilities
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
