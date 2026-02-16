"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import MessageCard, { MessageCardSkeleton } from "@/components/MessageCard";
import MessageDetailView from "@/components/MessageDetailView/MessageDetailView";
import type { InternalMessage } from "@/lib/types";
import { navigateBackOrReplace } from "@/lib/navigation-utils";

const PAGE_SIZE = 12;

type IngestErrorsCursor = {
  finalizedAt: string;
  id: string;
};

type IngestErrorsResponse = {
  messages: InternalMessage[];
  nextCursor?: IngestErrorsCursor;
};

const fetchIngestErrors = async ({
  pageParam,
}: {
  pageParam?: IngestErrorsCursor;
}): Promise<IngestErrorsResponse> => {
  const params = new URLSearchParams();

  if (pageParam) {
    params.set("cursorFinalizedAt", pageParam.finalizedAt);
    params.set("cursorId", pageParam.id);
  }

  const response = await fetch(`/api/messages/ingest-errors?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch ingest error messages");
  }

  return response.json();
};

export default function IngestErrorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
  } = useInfiniteQuery({
    queryKey: ["ingestErrors"],
    queryFn: fetchIngestErrors,
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const messages = useMemo(
    () => data?.pages.flatMap((page) => page.messages) ?? [],
    [data],
  );

  const selectedMessage = useMemo(() => {
    const messageId = searchParams.get("messageId");

    if (messages.length === 0) return null;

    if (messageId) {
      return messages.find((message) => message.id === messageId) || null;
    }

    return null;
  }, [messages, searchParams]);

  const handleMessageClick = useCallback(
    (message: InternalMessage) => {
      const url = `/ingest-errors?messageId=${encodeURIComponent(String(message.id))}`;
      router.push(url, { scroll: false });
    },
    [router],
  );

  const handleCloseDetail = useCallback(() => {
    navigateBackOrReplace(router, "/ingest-errors");
  }, [router]);

  const isEmpty = !isLoading && messages.length === 0;
  const isLoadingCards = isLoading || isFetchingNextPage;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-neutral-border">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Съобщения с проблеми при обработка
            </h1>
            <p className="text-sm text-neutral">
              Финализирани съобщения без GeoJSON, които съдържат записи за
              проблеми при обработка.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-error-border bg-error-light p-4 text-error">
            Не успях да заредя съобщенията. Моля, опитайте отново.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading &&
            Array.from({ length: PAGE_SIZE }, (_, index) => (
              <MessageCardSkeleton key={`skeleton-${index}`} />
            ))}

          {!isLoading &&
            messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onClick={handleMessageClick}
              >
                {message.ingestErrors && message.ingestErrors.length > 0 && (
                  <div className="mt-auto pt-4">
                    <div className="rounded-md border border-error-border bg-error-light text-error p-3 text-xs space-y-2">
                      <p className="font-semibold">Проблеми при обработка</p>
                      <ul className="list-disc list-inside space-y-1">
                        {message.ingestErrors.map((error, index) => (
                          <li
                            key={`${error.type}-${index}`}
                            className="break-words"
                          >
                            {error.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </MessageCard>
            ))}

          {isEmpty && (
            <div className="col-span-full text-center text-neutral py-8">
              Няма налични съобщения
            </div>
          )}
        </div>

        {hasNextPage && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => {
                fetchNextPage();
              }}
              className="px-6 py-3 rounded-md border border-neutral-border bg-white text-neutral hover:bg-neutral-light transition"
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Зареждане..." : "Покажи още"}
            </button>
          </div>
        )}

        {isLoadingCards && !isLoading && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }, (_, index) => (
              <MessageCardSkeleton key={`loading-${index}`} />
            ))}
          </div>
        )}
      </div>

      <MessageDetailView
        message={selectedMessage}
        onClose={handleCloseDetail}
        onAddressClick={(lat, lng) => {
          router.push(`/?lat=${lat}&lng=${lng}`, { scroll: false });
        }}
      />
    </div>
  );
}
