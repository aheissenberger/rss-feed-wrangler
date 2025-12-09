/**
 * Splits text at the first paragraph boundary
 * Handles HTML <p> tags first, then falls back to \n\n delimiters
 */
export function splitAtFirstParagraph(text: string): {
  firstParagraph: string;
  secondPart: string;
} {
  if (!text || text.trim().length === 0) {
    return { firstParagraph: text, secondPart: "" };
  }

  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n");

  // Try to split by HTML <p> tags first
  const pTagMatch = normalized.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pTagMatch) {
    const firstParagraph = pTagMatch[0];
    const startIndex = pTagMatch.index || 0;
    const endIndex = startIndex + firstParagraph.length;
    const secondPart = normalized.substring(endIndex).trim();
    return {
      firstParagraph: firstParagraph.trim(),
      secondPart: secondPart,
    };
  }

  // Fall back to double newline split
  const parts = normalized.split(/\n\n+/);
  if (parts.length > 1) {
    return {
      firstParagraph: parts[0].trim(),
      secondPart: parts.slice(1).join("\n\n").trim(),
    };
  }

  // If no clear paragraph boundary, treat whole text as first paragraph
  return {
    firstParagraph: text.trim(),
    secondPart: "",
  };
}

/**
 * Sanitizes and escapes HTML content for use in atom:content type="html"
 */
export function escapeHtmlContent(content: string): string {
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Detects the type of content (plain text, HTML, or XHTML)
 */
export function detectContentType(
  content: string
): "text" | "html" | "xhtml" {
  const trimmed = content.trim();

  // Check for XHTML div wrapper
  if (trimmed.match(/^<div[^>]*>[\s\S]*<\/div>$/i)) {
    return "xhtml";
  }

  // Check for HTML tags
  if (trimmed.match(/<[a-z]+[^>]*>/i)) {
    return "html";
  }

  return "text";
}

/**
 * Removes all HTML tags, leaving plain text only.
 */
export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}
