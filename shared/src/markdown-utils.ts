/**
 * Strip markdown formatting from text for plain text display
 * Removes common markdown patterns like **bold**, *italic*, # headers, [links](url), etc.
 * 
 * This is a lightweight, regex-based implementation that doesn't require any dependencies.
 * Safe to use in both browser and Node.js environments.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Remove bold (**text** or __text__)
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // Remove italic (*text*) - only when * is used for emphasis
      .replace(/\*(.+?)\*/g, "$1")
      // Remove italic with underscore (_text_) - only when surrounded by spaces or at boundaries
      // Use lookahead/lookbehind to avoid consuming boundary characters
      // This prevents matching underscores in identifiers like SF_5267_04
      .replace(/(?<=\s|^)_([^_]+?)_(?=\s|$)/g, "$1")
      // Remove headers (# Header)
      .replace(/^#{1,6}\s+/gm, "")
      // Remove links [text](url)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove inline code (`code`)
      .replace(/`(.+?)`/g, "$1")
      // Remove unordered list markers (-, *, +)
      .replace(/^[\s]*[-*+]\s+/gm, "")
      // Remove ordered list markers (1., 2., etc.)
      .replace(/^[\s]*\d+\.\s+/gm, "")
      // Decode HTML entities
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&euro;/g, "€")
      .replace(/&amp;/g, "&")
      // Normalize whitespace
      .replace(/\s+/g, " ")
      .trim()
  );
}
