"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import MessageCard, { MessageCardSkeleton } from "@/components/MessageCard";
import MessageDetailView from "@/components/MessageDetailView/MessageDetailView";
import type { InternalMessage } from "@/lib/types";
import { navigateBackOrReplace } from "@/lib/navigation-utils";
import { getButtonClasses } from "@/lib/theme";

const PAGE_SIZE = 12;

type UnreadableCursor = {
  finalizedAt: string;
  id: string;
};

type UnreadableResponse = {
  messages: InternalMessage[];
  nextCursor?: UnreadableCursor;
};

const fetchUnreadable = async ({
  pageParam,
}: {
  pageParam?: UnreadableCursor;
}): Promise<UnreadableResponse> => {
  const params = new URLSearchParams();

  if (pageParam) {
    params.set("cursorFinalizedAt", pageParam.finalizedAt);
    params.set("cursorId", pageParam.id);
  }

  const response = await fetch(`/api/messages/unreadable?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch unreadable messages");
  }

  return response.json();
};

export default function UnreadablePage() {
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
    queryKey: ["unreadableMessages"],
    queryFn: fetchUnreadable,
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
      const url = `/unreadable?messageId=${encodeURIComponent(String(message.id))}`;
      router.push(url, { scroll: false });
    },
    [router],
  );

  const handleCloseDetail = useCallback(() => {
    navigateBackOrReplace(router, "/unreadable");
  }, [router]);

  const isEmpty = !isLoading && messages.length === 0;
  const isLoadingCards = isLoading || isFetchingNextPage;

  return (
    <div className="min-h-screen bg-neutral-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back link */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-primary hover:text-primary-hover inline-flex items-center gap-2"
          >
            <span>←</span>
            <span>Начало</span>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-neutral-border">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Нечетими съобщения
            </h1>
            <p className="text-sm text-neutral">
              Съобщения, при които институцията е публикувала само линк към PDF
              или DOCX документ без четимо текстово съдържание.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-error-border bg-error-light p-4 text-error">
            Грешка при зареждане на съобщенията. Опитай отново.
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
              />
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
              className={getButtonClasses("ghost", "lg", "sm")}
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
