"use client";

import { Message } from "@/lib/types";
import { useMemo } from "react";
import MessageCard, { MessageCardSkeleton } from "./MessageCard";

interface MessagesGridProps {
  readonly messages: Message[];
  readonly isLoading: boolean;
  readonly onMessageClick: (message: Message) => void;
  readonly limit?: number;
  readonly showHeading?: boolean;
  readonly variant?: "grid" | "list";
}

export default function MessagesGrid({
  messages,
  isLoading,
  onMessageClick,
  limit = 6,
  showHeading = true,
  variant = "grid",
}: MessagesGridProps) {
  // Helper to parse date
  const parseDate = (dateValue: Date | string | undefined): Date => {
    if (!dateValue) return new Date(0);
    return typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  };

  // Generate skeleton keys once
  const skeletonKeys = useMemo(
    () => Array.from({ length: limit }, (_, i) => `skeleton-${i}`),
    [limit],
  );

  // Filter messages with both geoJson.features and finalizedAt
  const allFinalizedMessages = messages
    .filter((message) => message.geoJson?.features && message.finalizedAt)
    .sort((a, b) => {
      // Sort by finalizedAt descending (newest first)
      const dateA = parseDate(a.finalizedAt);
      const dateB = parseDate(b.finalizedAt);

      return dateB.getTime() - dateA.getTime();
    });

  // If total is within limit+4, show all instead of truncating
  const shouldShowAll = allFinalizedMessages.length <= limit + 4;
  const finalizedMessages = shouldShowAll
    ? allFinalizedMessages
    : allFinalizedMessages.slice(0, limit);
  const remainingCount = allFinalizedMessages.length - finalizedMessages.length;

  const containerClasses =
    variant === "list"
      ? "grid grid-cols-1 @lg:grid-cols-2 gap-4"
      : "grid grid-cols-1 @md:grid-cols-2 @xl:grid-cols-3 gap-6";

  const headingText = variant === "list" ? "Събития" : "Последни съобщения";

  return showHeading ? (
    <div className={variant === "list" ? "" : "bg-gray-50 py-12"}>
      <div
        className={
          variant === "list" ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        }
      >
        <h2
          className={
            variant === "list"
              ? "text-lg font-medium text-gray-700 mb-4"
              : "text-3xl font-bold text-gray-900 mb-8"
          }
        >
          {headingText}
        </h2>

        <div className={containerClasses}>
          {isLoading &&
            // Show skeleton cards while loading
            skeletonKeys.map((key) => <MessageCardSkeleton key={key} />)}
          {!isLoading &&
            finalizedMessages.length > 0 &&
            // Show actual message cards
            finalizedMessages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                onClick={onMessageClick}
              />
            ))}
          {!isLoading && finalizedMessages.length === 0 && (
            // Empty state (show nothing, just display available messages)
            <div
              className={
                variant === "list"
                  ? "text-center text-gray-500 py-8"
                  : "col-span-full text-center text-gray-500 py-8"
              }
            >
              Няма налични съобщения
            </div>
          )}
        </div>
        {!isLoading && remainingCount > 0 && (
          <div className="text-center text-sm text-neutral mt-4">
            ...и още {remainingCount} събития
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className={containerClasses}>
      {isLoading &&
        // Show skeleton cards while loading
        skeletonKeys.map((key) => <MessageCardSkeleton key={key} />)}
      {!isLoading &&
        finalizedMessages.length > 0 &&
        // Show actual message cards
        finalizedMessages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            onClick={onMessageClick}
          />
        ))}
      {!isLoading && finalizedMessages.length === 0 && (
        // Empty state (show nothing, just display available messages)
        <div
          className={
            variant === "list"
              ? "text-center text-gray-500 py-8"
              : "col-span-full text-center text-gray-500 py-8"
          }
        >
          Няма налични съобщения
        </div>
      )}
      {!isLoading && remainingCount > 0 && (
        <div className="text-center text-sm text-neutral mt-4">
          ...и още {remainingCount} събития
        </div>
      )}
    </div>
  );
}
