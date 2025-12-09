import { parseStringPromise, Builder } from "xml2js";
import {
  splitAtFirstParagraph,
  detectContentType,
  stripHtmlTags,
} from "./text-splitter.ts";

interface AtomEntry {
  summary?: string | string[];
  content?: string | string[] | { _: string; $: Record<string, string> }[];
  [key: string]: unknown;
}

interface AtomFeed {
  feed?: {
    entry?: AtomEntry | AtomEntry[];
    [key: string]: unknown;
  };
  rss?: {
    $?: Record<string, string>;
    channel?: {
      item?: AtomEntry | AtomEntry[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

/**
 * Processes an Atom feed and splits summaries into summary and content
 */
export async function processAtomFeed(feedXml: string): Promise<string> {
  // Parse the XML
  const feed: AtomFeed = await parseStringPromise(feedXml, {
    trim: true,
    explicitArray: false,
    preserveChildrenOrder: true,
  });

  const isAtom = !!feed.feed;
  const isRss = !!feed.rss?.channel?.item;

  // ----- Atom processing -----
  if (isAtom) {
    const entries = Array.isArray(feed.feed?.entry)
      ? feed.feed?.entry
      : feed.feed?.entry
        ? [feed.feed?.entry]
        : [];

    if (entries.length === 0) {
      return feedXml;
    }

    entries.forEach((entry: AtomEntry) => {
      if (entry.summary) {
        const summaryText =
          typeof entry.summary === "string"
            ? entry.summary
            : Array.isArray(entry.summary)
              ? entry.summary[0]
              : "";

        if (summaryText) {
          const { firstParagraph, secondPart } =
            splitAtFirstParagraph(summaryText);

          const cleanedSummary = stripHtmlTags(firstParagraph);
          entry.summary = cleanedSummary;

          if (secondPart) {
            const contentType = detectContentType(secondPart);
            // Preserve HTML/XHTML in CDATA by letting builder wrap text
            entry.content = [
              {
                _: secondPart,
                $: { type: contentType === "text" ? "html" : contentType },
              },
            ];
          }
        }
      }
    });
  }

  // ----- RSS 2.0 processing -----
  if (!isAtom && isRss) {
    const channel = feed.rss?.channel;
    const items = Array.isArray(channel?.item)
      ? channel?.item
      : channel?.item
        ? [channel?.item]
        : [];

    if (items.length === 0) {
      return feedXml;
    }

    // Ensure content namespace exists for content:encoded
    if (feed.rss) {
      feed.rss.$ = feed.rss.$ || {};
      if (!feed.rss.$["xmlns:content"]) {
        feed.rss.$["xmlns:content"] = "http://purl.org/rss/1.0/modules/content/";
      }
    }

    items.forEach((entry: AtomEntry) => {
      if (!entry.summary && (entry as any).description) {
        entry.summary = (entry as any).description as string;
      }

      if (entry.summary) {
        const summaryText =
          typeof entry.summary === "string"
            ? entry.summary
            : Array.isArray(entry.summary)
              ? entry.summary[0]
              : "";

        if (summaryText) {
          const { firstParagraph, secondPart } =
            splitAtFirstParagraph(summaryText);

          // Update description/summary
          const cleanedSummary = stripHtmlTags(firstParagraph);
          entry.summary = cleanedSummary;
          (entry as any).description = cleanedSummary;

          if (secondPart) {
            const contentType = detectContentType(secondPart);

            const payload = secondPart;

            // Let builder wrap in CDATA to avoid escaping HTML
            (entry as any)["content:encoded"] = payload;
          }
        }
      }
    });
  }

  // Rebuild XML
  const builder = new Builder({
    xmldec: { version: "1.0", encoding: "UTF-8" },
    renderOpts: { pretty: true },
    cdata: true,
  });

  return builder.buildObject(feed);
}

/**
 * Fetches and processes an Atom feed from a URL
 */
export async function fetchAndProcessFeed(feedUrl: string): Promise<string> {
  let feedContent: string;

  try {
    // Create an AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "AtomFeedWrangler/1.0 (https://github.com/yourusername/rss-feed-wrangler)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch feed: HTTP ${response.status} ${response.statusText}`
      );
    }

    feedContent = await response.text();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error fetching feed";
    throw new Error(`Failed to fetch feed from ${feedUrl}: ${message}`);
  }

  return processAtomFeed(feedContent);
}
