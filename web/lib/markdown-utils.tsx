import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Strip markdown formatting from text for plain text display
 * Uses react-markdown with plain text renderers to extract content
 */
export function stripMarkdown(text: string): string {
  // Create components that just output text content
  const textOnlyComponents: Components = {
    // Just output text content for all elements
    p: ({ children }) => <>{children}</>,
    h1: ({ children }) => <>{children}</>,
    h2: ({ children }) => <>{children}</>,
    h3: ({ children }) => <>{children}</>,
    h4: ({ children }) => <>{children}</>,
    h5: ({ children }) => <>{children}</>,
    h6: ({ children }) => <>{children}</>,
    strong: ({ children }) => <>{children}</>,
    em: ({ children }) => <>{children}</>,
    a: ({ children }) => <>{children}</>,
    code: ({ children }) => <>{children}</>,
    ul: ({ children }) => <>{children}</>,
    ol: ({ children }) => <>{children}</>,
    li: ({ children }) => <>{children} </>,
    blockquote: ({ children }) => <>{children}</>,
    br: () => <> </>,
  };

  // Render markdown to static markup with text-only components
  const markup = renderToStaticMarkup(
    <ReactMarkdown components={textOnlyComponents} skipHtml={true}>
      {text}
    </ReactMarkdown>,
  );

  // The markup will still have some HTML tags, so extract text content
  // and normalize whitespace, then decode HTML entities
  return (
    markup
      .replace(/<[^>]*>/g, "") // Remove any remaining HTML tags
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      // Decode common HTML entities to plain text
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/&euro;/g, "€")
  );
}
