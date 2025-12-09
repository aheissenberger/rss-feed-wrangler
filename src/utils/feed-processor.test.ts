import { test } from "node:test";
import { strict as assert } from "node:assert";
import { processAtomFeed } from "./feed-processor.ts";
// Helper to escape HTML entities for XML
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};


// Mock feed templates
const createAtomEntry = (summary: string, content?: string): string => {
  let contentTag = "";
  if (content) {
    contentTag = `<content type="html"><![CDATA[${content}]]></content>`;
  }

  return `
    <entry>
      <title>Test Entry</title>
      <id>urn:uuid:test-entry</id>
      <updated>2025-12-09T00:00:00Z</updated>
      <summary>${escapeXml(summary)}</summary>
      ${contentTag}
    </entry>
  `;
};

const createAtomFeed = (entries: string): string => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <id>urn:uuid:test-feed</id>
  <updated>2025-12-09T00:00:00Z</updated>
  <link href="http://example.com/"/>
  ${entries}
</feed>`;
};

test("processAtomFeed - Single entry with HTML p tags", async (t) => {
  await t.test(
    "should split HTML p tag summary into summary and content",
    async () => {
      const entry = createAtomEntry(
        "<p>First paragraph</p><p>Second paragraph</p>"
      );
      const feed = createAtomFeed(entry);

      const result = await processAtomFeed(feed);

      // Check for summary with first paragraph (accounting for whitespace)
      assert.ok(result.includes("<summary>"));
      // Summary should be plain text without HTML tags
      assert.ok(result.includes("<summary>First paragraph</summary>"));
      assert.ok(result.includes('<content'));
      assert.ok(result.includes('type="html"'));
      assert.ok(result.includes("Second paragraph"));
    }
  );
});

test("processAtomFeed - Single entry with newline separated paragraphs", async (t) => {
  await t.test(
    "should split on double newlines into summary and content",
    async () => {
      const entry = createAtomEntry(
        "First paragraph\n\nSecond paragraph\n\nThird paragraph"
      );
      const feed = createAtomFeed(entry);

      const result = await processAtomFeed(feed);

      assert.ok(result.includes("<summary>First paragraph</summary>"));
      assert.ok(result.includes('<content type="html">'));
      assert.ok(result.includes("Second paragraph"));
    }
  );
});

test("processAtomFeed - Multiple entries", async (t) => {
  await t.test("should process all entries in feed", async () => {
    const entry1 = createAtomEntry(
      "<p>First entry paragraph one</p><p>First entry paragraph two</p>"
    );
    const entry2 = createAtomEntry(
      "Second entry para 1\n\nSecond entry para 2"
    );
    const feed = createAtomFeed(entry1 + entry2);

    const result = await processAtomFeed(feed);

    // Check first entry processed
    assert.ok(result.includes("First entry paragraph one"));
    assert.ok(result.includes("First entry paragraph two"));

    // Check second entry processed
    assert.ok(result.includes("Second entry para 1"));
    assert.ok(result.includes("Second entry para 2"));
  });
});

test("processAtomFeed - Single paragraph entries", async (t) => {
  await t.test("should keep single paragraph in summary only", async () => {
    const entry = createAtomEntry("Only one paragraph here");
    const feed = createAtomFeed(entry);

    const result = await processAtomFeed(feed);

    assert.ok(result.includes("<summary>Only one paragraph here</summary>"));
    // Should not have content tag added
    const contentCount = (result.match(/<content/g) || []).length;
    assert.equal(contentCount, 0);
  });
});

test("processAtomFeed - XML structure preservation", async (t) => {
  await t.test("should preserve feed metadata", async () => {
    const entry = createAtomEntry("Test summary");
    const feed = createAtomFeed(entry);

    const result = await processAtomFeed(feed);

    assert.ok(result.includes("<title>Test Feed</title>"));
    assert.ok(result.includes("urn:uuid:test-feed"));
    assert.ok(result.includes("http://example.com/"));
  });

  await t.test("should preserve entry metadata", async () => {
    const entry = createAtomEntry("Test summary");
    const feed = createAtomFeed(entry);

    const result = await processAtomFeed(feed);

    assert.ok(result.includes("<title>Test Entry</title>"));
    assert.ok(result.includes("urn:uuid:test-entry"));
  });
});

test("processAtomFeed - Empty and whitespace handling", async (t) => {
  await t.test("should handle entry with empty summary", async () => {
    const entry = `
      <entry>
        <title>Test Entry</title>
        <id>urn:uuid:test</id>
        <updated>2025-12-09T00:00:00Z</updated>
        <summary></summary>
      </entry>
    `;
    const feed = createAtomFeed(entry);

    const result = await processAtomFeed(feed);

    // XML builder may format empty tags as <summary/> or <summary></summary>
    assert.ok(result.includes("<summary"));
    assert.ok(!result.includes("<content"), "Should not add content for empty summary");
  });
});

test("processAtomFeed - Mixed content types", async (t) => {
  await t.test("should handle entries without summary element", async () => {
    const entry = `
      <entry>
        <title>Test Entry</title>
        <id>urn:uuid:test</id>
        <updated>2025-12-09T00:00:00Z</updated>
      </entry>
    `;
    const feed = createAtomFeed(entry);

    // Should not throw
    const result = await processAtomFeed(feed);
    assert.ok(result.includes("<title>Test Entry</title>"));
  });
});

test("processAtomFeed - HTML escaping in content", async (t) => {
  await t.test("should create proper content element", async () => {
    const entry = createAtomEntry("First para\n\nSecond paragraph with text");
    const feed = createAtomFeed(entry);

    const result = await processAtomFeed(feed);

    assert.ok(result.includes('<content'));
    assert.ok(result.includes('type="html"'));
    assert.ok(result.includes("</content>"));
    assert.ok(result.includes("Second paragraph"));
  });
});

test("processAtomFeed - Real-world Atom feed example", async (t) => {
  await t.test("should process realistic Atom feed structure", async () => {
    const realWorldFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Example Feed</title>
  <link href="http://example.org/"/>
  <link rel="self" href="http://example.org/feed.atom"/>
  <id>urn:uuid:60a76c80-d399-11d9-b91C-0003939e0af6</id>
  <updated>2003-12-13T18:30:02Z</updated>
  <entry>
    <title>Atom-Powered Robots Run Amok</title>
    <link href="http://example.org/2003/12/13/atom03"/>
    <link rel="alternate" type="text/html" href="http://example.org/2003/12/13/atom03.html"/>
    <link rel="edit" href="http://example.org/2003/12/13/atom03/edit"/>
    <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
    <updated>2003-12-13T18:30:02Z</updated>
    <summary>This is the first paragraph of the entry.

This is the second paragraph with more details.

This is the third paragraph.</summary>
  </entry>
</feed>`;

    const result = await processAtomFeed(realWorldFeed);

    // Should split at first paragraph
    assert.ok(
      result.includes("<summary>This is the first paragraph of the entry.</summary>")
    );

    // Should create content element with remaining paragraphs
    assert.ok(result.includes('<content type="html">'));
    assert.ok(result.includes("second paragraph"));
    assert.ok(result.includes("third paragraph"));

    // Should preserve feed structure
    assert.ok(result.includes("<title>Example Feed</title>"));
    assert.ok(result.includes("<title>Atom-Powered Robots Run Amok</title>"));
  });
});
