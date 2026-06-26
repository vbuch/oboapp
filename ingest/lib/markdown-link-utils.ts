export function hasMarkdownInlineLink(text: string): boolean {
  let cursor = 0;
  while (true) {
    const openBracket = text.indexOf("[", cursor);
    if (openBracket === -1) {
      return false;
    }

    const mid = text.indexOf("](", openBracket + 1);
    if (mid === -1) {
      return false;
    }

    const closeParen = text.indexOf(")", mid + 2);
    if (closeParen !== -1) {
      return true;
    }

    cursor = mid + 2;
  }
}
