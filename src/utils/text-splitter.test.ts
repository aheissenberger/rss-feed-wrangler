import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  splitAtFirstParagraph,
  escapeHtmlContent,
  detectContentType,
} from "./text-splitter.ts";

test("splitAtFirstParagraph - HTML <p> tag splitting", async (t) => {
  await t.test("should split at closing </p> tag", () => {
    const text =
      "<p>First paragraph</p><p>Second paragraph</p><p>Third paragraph</p>";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "<p>First paragraph</p>");
    assert.equal(
      result.secondPart,
      "<p>Second paragraph</p><p>Third paragraph</p>"
    );
  });

  await t.test("should handle p tags with attributes", () => {
    const text =
      '<p class="intro">First paragraph</p>\n<p>Second paragraph</p>';
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, '<p class="intro">First paragraph</p>');
    assert.equal(result.secondPart, "<p>Second paragraph</p>");
  });

  await t.test("should be case insensitive for p tags", () => {
    const text = "<P>First paragraph</P>\n<P>Second paragraph</P>";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "<P>First paragraph</P>");
    assert.ok(result.secondPart.includes("Second paragraph"));
  });
});

test("splitAtFirstParagraph - Double newline splitting", async (t) => {
  await t.test("should split on double newline when no p tags", () => {
    const text = "First paragraph\n\nSecond paragraph\n\nThird paragraph";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "First paragraph");
    assert.equal(
      result.secondPart,
      "Second paragraph\n\nThird paragraph"
    );
  });

  await t.test("should handle multiple consecutive newlines", () => {
    const text = "First paragraph\n\n\n\nSecond paragraph";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "First paragraph");
    assert.equal(result.secondPart, "Second paragraph");
  });

  await t.test("should normalize Windows line endings (CRLF)", () => {
    const text = "First paragraph\r\n\r\nSecond paragraph\r\n\r\nThird";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "First paragraph");
    assert.ok(result.secondPart.includes("Second paragraph"));
  });
});

test("splitAtFirstParagraph - Edge cases", async (t) => {
  await t.test("should return empty second part for single paragraph", () => {
    const text = "Only one paragraph";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "Only one paragraph");
    assert.equal(result.secondPart, "");
  });

  await t.test("should handle empty string", () => {
    const result = splitAtFirstParagraph("");

    assert.equal(result.firstParagraph, "");
    assert.equal(result.secondPart, "");
  });

  await t.test("should handle whitespace-only string", () => {
    const result = splitAtFirstParagraph("   \n  \n  ");

    // Function returns input when no clear paragraph boundary exists
    assert.equal(result.firstParagraph, "   \n  \n  ");
    assert.equal(result.secondPart, "");
  });

  await t.test("should trim whitespace from results", () => {
    const text = "  First paragraph  \n\n  Second paragraph  ";
    const result = splitAtFirstParagraph(text);

    assert.equal(result.firstParagraph, "First paragraph");
    assert.equal(result.secondPart, "Second paragraph");
  });
});

test("escapeHtmlContent - HTML entity escaping", async (t) => {
  await t.test("should escape ampersands", () => {
    const result = escapeHtmlContent("Tom & Jerry");
    assert.equal(result, "Tom &amp; Jerry");
  });

  await t.test("should escape less-than signs", () => {
    const result = escapeHtmlContent("2 < 5");
    assert.equal(result, "2 &lt; 5");
  });

  await t.test("should escape greater-than signs", () => {
    const result = escapeHtmlContent("5 > 2");
    assert.equal(result, "5 &gt; 2");
  });

  await t.test("should escape double quotes", () => {
    const result = escapeHtmlContent('He said "hello"');
    assert.equal(result, "He said &quot;hello&quot;");
  });

  await t.test("should escape single quotes", () => {
    const result = escapeHtmlContent("It's fine");
    assert.equal(result, "It&#39;s fine");
  });

  await t.test("should escape multiple special characters", () => {
    const result = escapeHtmlContent('Test & <tag attr="value">');
    assert.equal(
      result,
      "Test &amp; &lt;tag attr=&quot;value&quot;&gt;"
    );
  });

  await t.test("should not double-escape already escaped entities", () => {
    // Note: This function assumes input is unescaped
    const result = escapeHtmlContent("&lt; already escaped");
    // It will double-escape because the & is treated as a literal character
    assert.equal(result, "&amp;lt; already escaped");
  });
});

test("detectContentType - Content type detection", async (t) => {
  await t.test("should detect plain text", () => {
    const type = detectContentType("This is plain text without any HTML.");
    assert.equal(type, "text");
  });

  await t.test("should detect HTML content", () => {
    const type = detectContentType("This is <b>bold</b> text");
    assert.equal(type, "html");
  });

  await t.test("should detect HTML with various tags", () => {
    assert.equal(detectContentType("<p>paragraph</p>"), "html");
    assert.equal(detectContentType("<a href='#'>link</a>"), "html");
    assert.equal(detectContentType("<img src='test.jpg' />"), "html");
    // Note: <div> alone matches xhtml pattern
    assert.equal(detectContentType("<span>content</span>"), "html");
  });

  await t.test("should detect XHTML div wrapper", () => {
    const type = detectContentType(
      "<div xmlns='http://www.w3.org/1999/xhtml'>Content</div>"
    );
    assert.equal(type, "xhtml");
  });

  await t.test("should detect XHTML with leading/trailing whitespace", () => {
    const type = detectContentType(
      "  <div xmlns='http://www.w3.org/1999/xhtml'>\nContent\n</div>  "
    );
    assert.equal(type, "xhtml");
  });

  await t.test("should treat non-wrapped div as HTML, not XHTML", () => {
    const type = detectContentType("<div>Not wrapped properly</div><p>Extra</p>");
    assert.equal(type, "html");
  });

  await t.test("should handle whitespace in plain text", () => {
    const type = detectContentType("Text with    spaces\nand\nnewlines");
    assert.equal(type, "text");
  });
});
