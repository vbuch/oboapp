"use client";

import { useState, useId } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Message, EventMessage } from "@oboapp/shared";
import sources from "@/lib/sources";
import { stripMarkdown } from "@/lib/markdown-utils";
import { createSnippet } from "@/lib/text-utils";
import { createMessageUrlFromId } from "@/lib/url-utils";
import SourceLogo from "@/components/SourceLogo";

interface LinkedMessagesAccordionProps {
  readonly eventId: string;
  readonly currentMessageId: string;
}

type EventMessagesResponse = {
  messages: Message[];
  eventMessages: EventMessage[];
};

function makeSnippet(text: string): string {
  return createSnippet(stripMarkdown(text), 120);
}

function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

function SiblingRow({
  message,
  eventMessage,
}: {
  readonly message: Message & { id: string };
  readonly eventMessage: EventMessage | undefined;
}) {
  const sourceInfo = sources.find((s) => s.id === message.source);
  const displayText = message.markdownText || message.text;

  return (
    <a
      href={createMessageUrlFromId(message.id)}
      className="flex items-start gap-3 py-2 px-3 border-b border-neutral-border last:border-b-0 hover:bg-neutral-light/50 transition-colors"
    >
      <div className="flex-shrink-0 mt-0.5">
        {message.source && <SourceLogo sourceId={message.source} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-neutral-dark truncate">
            {sourceInfo?.name || message.source || "Неизвестен"}
          </span>
          {eventMessage && (
            <span
              className="text-sm text-neutral flex-shrink-0"
              title="Увереност на съвпадението"
            >
              {formatConfidence(eventMessage.confidence)}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral leading-relaxed">
          {makeSnippet(displayText)}
        </p>
      </div>
    </a>
  );
}

export default function LinkedMessagesAccordion({
  eventId,
  currentMessageId,
}: LinkedMessagesAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const labelId = useId();

  const { data, isLoading, error } = useQuery<EventMessagesResponse>({
    queryKey: ["eventMessages", eventId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/events/messages?eventId=${encodeURIComponent(eventId)}`,
        { signal },
      );
      if (!res.ok) throw new Error("Failed to fetch event messages");
      return res.json();
    },
  });

  const siblings = data
    ? {
        messages: data.messages.filter(
          (m): m is typeof m & { id: string } =>
            !!m.id && m.id !== currentMessageId,
        ),
        eventMessages: data.eventMessages.filter(
          (em) => em.messageId !== currentMessageId,
        ),
      }
    : null;

  if (isLoading) return null;

  if (error) {
    return (
      <p className="text-sm text-error px-1">
        Грешка при зареждане на свързаните съобщения.
      </p>
    );
  }

  if (!siblings || siblings.messages.length === 0) {
    return null;
  }

  const toggleLabel = `Свързани съобщения (${siblings.messages.length})`;
  const eventMessagesByMessageId = new Map(
    siblings.eventMessages.map((em) => [em.messageId, em]),
  );

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full inline-flex items-center justify-between gap-2 text-sm font-medium text-neutral-dark bg-neutral-light rounded-md p-3 border border-neutral-border hover:bg-info-light hover:border-info-border transition-colors cursor-pointer"
      >
        <span id={labelId}>{toggleLabel}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <div id={contentId} role="region" aria-labelledby={labelId} hidden={!isOpen}>
        <div className="border border-neutral-border rounded-md bg-neutral-light/30 overflow-hidden">
          {siblings.messages.map((message) => (
            <SiblingRow
              key={message.id}
              message={message}
              eventMessage={eventMessagesByMessageId.get(message.id ?? "")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
