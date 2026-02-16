"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { Message } from "@/lib/types";
import { classifyMessage } from "@/lib/message-classification";
import { useDragPanel } from "@/lib/hooks/useDragPanel";
import { useMessageAnimation } from "@/lib/hooks/useMessageAnimation";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { zIndex } from "@/lib/colors";
import Header from "./Header";
import SourceDisplay from "./Source";
import Locations from "./Locations";
import DetailItem from "./DetailItem";
import MessageText from "./MessageText";
import CategoryChips from "@/components/CategoryChips";
import { getCentroid } from "@/lib/geometry-utils";

type CloseMethod = "drag" | "esc" | "backdrop";

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("bg-BG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Calculate combined centroid from all GeoJSON features
function getFeaturesCentroid(
  geoJson: Message["geoJson"],
): { lat: number; lng: number } | null {
  const features = geoJson?.features;
  if (!features || features.length === 0) return null;

  const centroids = features
    .map((f) => getCentroid(f.geometry))
    .filter((c): c is { lat: number; lng: number } => c !== null);

  if (centroids.length === 0) return null;

  const avgLat = centroids.reduce((sum, c) => sum + c.lat, 0) / centroids.length;
  const avgLng = centroids.reduce((sum, c) => sum + c.lng, 0) / centroids.length;

  return { lat: avgLat, lng: avgLng };
}

interface MessageDetailViewProps {
  readonly message: Message | null;
  readonly onClose: () => void;
  readonly onAddressClick?: (lat: number, lng: number) => void;
}

export default function MessageDetailView({
  message,
  onClose,
  onAddressClick,
}: Readonly<MessageDetailViewProps>) {
  // Centralized close handler with analytics tracking
  const handleClose = useCallback(
    (method: CloseMethod) => {
      if (message) {
        trackEvent({
          name: "message_detail_closed",
          params: {
            message_id: message.id || "unknown",
            close_method: method,
          },
        });
      }
      onClose();
    },
    [message, onClose],
  );

  // Drag to close functionality
  const { isDragging, dragOffset, handlers } = useDragPanel({
    direction: "vertical",
    isOpen: true,
    onAction: () => handleClose("drag"),
  });

  // Handle animation state
  const isVisible = useMessageAnimation(message);

  // Close on ESC key
  useEscapeKey(() => handleClose("esc"), !!message);

  if (!message) return null;

  return (
    <>
      <div
        className={`fixed inset-0 ${zIndex.overlay} bg-black/20 backdrop-blur-sm pointer-events-auto transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={() => handleClose("backdrop")}
        aria-hidden="true"
      />

      <aside
        aria-label="Детайли за сигнала"
        className={`fixed ${zIndex.overlayContent} bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-out
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          sm:inset-y-0 sm:left-auto sm:right-0 sm:w-96 sm:max-h-none sm:rounded-none
          ${
            isVisible
              ? "translate-y-0 sm:translate-y-0 sm:translate-x-0"
              : "translate-y-full sm:translate-y-0 sm:translate-x-full"
          }
        `}
        style={{
          transform: isDragging ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? "none" : undefined,
        }}
      >
        <Header
          handlers={handlers}
          onClose={onClose}
          messageId={message.id}
          classification={classifyMessage(message)}
        />

        <div
          className={`px-4 sm:px-6 py-4 pb-6 sm:pb-4 space-y-6 transition-opacity duration-500 delay-100 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {message.finalizedAt && (
            <DetailItem title="Публикувано тук">
              <p className="text-base text-gray-900">
                {formatDate(message.finalizedAt)}
              </p>
            </DetailItem>
          )}

          {message.source && (
            <SourceDisplay
              sourceId={message.source}
              sourceUrl={message.sourceUrl}
            />
          )}

          {message.categories && message.categories.length > 0 && (
            <DetailItem title="Категории">
              <CategoryChips categories={message.categories} />
            </DetailItem>
          )}

          <DetailItem title="Текст">
            <MessageText
              text={message.text}
              markdownText={message.markdownText}
            />
          </DetailItem>

          {message.responsibleEntity && (
            <DetailItem title="Отговорна институция">
              <p className="text-base text-gray-900">
                {message.responsibleEntity}
              </p>
            </DetailItem>
          )}

          <Locations
            pins={message.pins}
            streets={message.streets}
            busStops={message.busStops}
            cadastralProperties={message.cadastralProperties}
            addresses={message.addresses}
            onLocationClick={onAddressClick}
          />

          {message.geoJson?.features &&
            message.geoJson.features.length > 0 &&
            (() => {
              const centroid = getFeaturesCentroid(message.geoJson);
              const isClickable = centroid && onAddressClick;
              const handleGeoClick = () => {
                if (centroid && onAddressClick) {
                  onAddressClick(centroid.lat, centroid.lng);
                  // Scroll body to bring the map into view (especially on mobile)
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              };
              return (
                <DetailItem title="Обекти на картата">
                  {isClickable ? (
                    <button
                      type="button"
                      onClick={handleGeoClick}
                      className="w-full text-left bg-neutral-light rounded-md p-3 border border-neutral-border hover:bg-info-light hover:border-info-border transition-colors cursor-pointer"
                    >
                      <p className="text-sm text-foreground">
                        {message.geoJson!.features.length}{" "}
                        {message.geoJson!.features.length === 1
                          ? "обект"
                          : "обекта"}{" "}
                        на картата
                      </p>
                    </button>
                  ) : (
                    <p className="text-sm text-gray-900">
                      {message.geoJson!.features.length}{" "}
                      {message.geoJson!.features.length === 1
                        ? "обект"
                        : "обекта"}{" "}
                      на картата
                    </p>
                  )}
                </DetailItem>
              );
            })()}
        </div>
      </aside>
    </>
  );
}
