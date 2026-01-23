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
}

export default function MessagesGrid({
  messages,
  isLoading,
  onMessageClick,
  limit = 6,
  showHeading = true,
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
  const finalizedMessages = messages
    .filter((message) => message.geoJson?.features && message.finalizedAt)
    .sort((a, b) => {
      // Sort by finalizedAt descending (newest first)
      const dateA = parseDate(a.finalizedAt);
      const dateB = parseDate(b.finalizedAt);

      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, limit);

  return showHeading ? (
    <div className="bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">
          Последни съобщения
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <div className="col-span-full text-center text-gray-500 py-8">
              Няма налични съобщения
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="col-span-full text-center text-gray-500 py-8">
          Няма налични съобщения
        </div>
      )}
    </div>
  );
}
