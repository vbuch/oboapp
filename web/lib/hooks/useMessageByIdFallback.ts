import { useEffect, useMemo, useState } from "react";
import { isValidMessageId } from "@oboapp/shared";
import type { Message } from "@/lib/types";

/**
 * Resolves a selected message from a URL `messageId` parameter.
 *
 * First checks `listMatch` (a message already present in the loaded list).
 * When `listMatch` is null and `messageId` is valid, fetches the message from
 * `/api/messages/by-id` so that deep links to older messages always open the
 * detail view without requiring the user to paginate.
 *
 * @param messageId - The message ID from the URL search params (or null)
 * @param listMatch - The message found in the already-loaded list, or null
 * @returns The resolved message to display, or null
 */
export function useMessageByIdFallback(
  messageId: string | null,
  listMatch: Message | null,
): Message | null {
  const [fetchedMessage, setFetchedMessage] = useState<{
    id: string;
    message: Message;
  } | null>(null);

  useEffect(() => {
    if (!messageId || !isValidMessageId(messageId)) {
      return;
    }

    if (listMatch) {
      return;
    }

    if (fetchedMessage?.id === messageId) {
      return;
    }

    let cancelled = false;

    fetch(`/api/messages/by-id?id=${encodeURIComponent(messageId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data?.message) {
          setFetchedMessage({ id: messageId, message: data.message });
        }
      })
      .catch(() => {
        // Leave as null on error
      });

    return () => {
      cancelled = true;
    };
  }, [messageId, listMatch, fetchedMessage]);

  return useMemo(() => {
    if (!messageId) return null;
    if (listMatch) return listMatch;
    if (fetchedMessage?.id === messageId) return fetchedMessage.message;
    return null;
  }, [messageId, listMatch, fetchedMessage]);
}
