/**
 * Pure utility functions for message processing
 * These functions have no side effects and are deterministic
 */

/**
 * Generate a deterministic message ID based on source document and index
 * @param sourceDocumentId - Optional source document ID
 * @param messageIndex - Index of the message (1-based)
 * @returns Generated message ID or undefined if no source document ID
 */
export function generateMessageId(
  sourceDocumentId: string | undefined,
  messageIndex: number
): string | undefined {
  return sourceDocumentId && sourceDocumentId.trim() !== ""
    ? `${sourceDocumentId}-${messageIndex}`
    : undefined;
}

/**
 * Format log messages for categorized message processing
 * @param categorizedMessage - The categorized message object
 * @param messageIndex - Current message index (1-based)
 * @param totalMessages - Total number of messages
 * @param messageId - Generated or auto-generated message ID
 * @returns Array of formatted log message strings
 */
export function formatCategorizedMessageLogInfo(
  categorizedMessage: {
    categories: string[];
    isRelevant: boolean;
  },
  messageIndex: number,
  totalMessages: number,
  messageId: string | undefined
): string[] {
  return [
    `\n📄 Processing message ${messageIndex}/${totalMessages}`,
    `   Categories: ${categorizedMessage.categories.join(", ")}`,
    `   Relevant: ${categorizedMessage.isRelevant}`,
    `   Message ID: ${messageId || "auto-generated"}`,
  ];
}

/**
 * Create a summary statistics object for message ingestion results
 * @param totalCategorized - Total number of messages categorized
 * @param totalRelevant - Number of relevant messages
 * @param totalIrrelevant - Number of irrelevant messages
 * @returns Statistics object
 */
export function createIngestionStatistics(
  totalCategorized: number,
  totalRelevant: number,
  totalIrrelevant: number
): {
  totalCategorized: number;
  totalRelevant: number;
  totalIrrelevant: number;
  relevantPercentage: number;
} {
  return {
    totalCategorized,
    totalRelevant,
    totalIrrelevant,
    relevantPercentage:
      totalCategorized > 0 ? (totalRelevant / totalCategorized) * 100 : 0,
  };
}

/**
 * Validate message index bounds
 * @param messageIndex - The message index to validate
 * @param totalMessages - Total number of messages
 * @returns True if the index is valid
 */
export function isValidMessageIndex(
  messageIndex: number,
  totalMessages: number
): boolean {
  return (
    messageIndex >= 1 && messageIndex <= totalMessages && totalMessages > 0
  );
}

/**
 * Generate a display name for a message ID
 * @param messageId - The message ID (can be undefined)
 * @returns Human-readable display name
 */
export function getMessageDisplayName(messageId: string | undefined): string {
  return messageId && messageId.trim() !== "" ? messageId : "auto-generated";
}
