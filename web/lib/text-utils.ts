/**
 * Creates a snippet from text with word boundary truncation
 * @param text The full text to truncate
 * @param maxLength Maximum length for the snippet (default 75)
 * @returns Truncated text with ellipsis if needed
 */
export function createSnippet(text: string, maxLength = 75): string {
  if (text.length <= maxLength) return text;

  // Try to cut at a word boundary near maxLength
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  // Look for word boundary between 80% and 100% of maxLength
  const minBoundary = Math.floor(maxLength * 0.8);
  if (lastSpace > minBoundary) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}
