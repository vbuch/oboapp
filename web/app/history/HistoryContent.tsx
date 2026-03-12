"use client";

import { useState, useCallback } from "react";
import HistoryMapWrapper from "./HistoryMapWrapper";
import HistoryFilterModal from "./HistoryFilterModal";
import type { HeatmapStats } from "./HistoryMapClient";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Client component that owns the filter state for the history heatmap page.
 * Renders the stats paragraph (with a clickable "filters" link), the filter
 * modal, and the map.
 */
export default function HistoryContent() {
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<HeatmapStats | null>(null);

  const hasActiveFilters =
    selectedCategories.size > 0 || selectedSources.size > 0;

  const handleStatsLoaded = useCallback((newStats: HeatmapStats) => {
    setStats(newStats);
  }, []);

  const handleCloseModal = useCallback(() => setIsModalOpen(false), []);

  function handleApplyFilters(
    categories: Set<string>,
    sources: Set<string>,
  ) {
    // Shallow-compare to avoid triggering a re-fetch when nothing changed
    setSelectedCategories((prev) => {
      if (
        prev.size === categories.size &&
        [...categories].every((c) => prev.has(c))
      ) {
        return prev;
      }
      return new Set(categories);
    });
    setSelectedSources((prev) => {
      if (
        prev.size === sources.size &&
        [...sources].every((s) => prev.has(s))
      ) {
        return prev;
      }
      return new Set(sources);
    });
    setIsModalOpen(false);
  }

  // Inline description rendered as a paragraph below the main description
  const filterSummary = (() => {
    if (!stats) return null;

    const oldestFormatted = stats.oldestDate
      ? formatDate(stats.oldestDate)
      : null;

    if (!hasActiveFilters) {
      return (
        <p className="text-sm text-neutral">
          Картата е базирана на{" "}
          <span className="font-medium">
            {stats.messageCount.toLocaleString("bg-BG")} съобщения
          </span>
          {oldestFormatted && `, най-старото от ${oldestFormatted}`}. Без
          приложени{" "}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-primary underline hover:text-primary-hover transition-colors"
          >
            филтри
          </button>
          .
        </p>
      );
    }

    const parts: string[] = [];
    if (selectedCategories.size > 0) {
      parts.push(
        `${selectedCategories.size} ${selectedCategories.size === 1 ? "категория" : "категории"}`,
      );
    }
    if (selectedSources.size > 0) {
      parts.push(
        `${selectedSources.size} ${selectedSources.size === 1 ? "източник" : "източника"}`,
      );
    }

    return (
      <p className="text-sm text-neutral">
        Показват се{" "}
        <span className="font-medium">
          {stats.messageCount.toLocaleString("bg-BG")} съобщения
        </span>{" "}
        от{" "}
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="text-primary underline hover:text-primary-hover transition-colors"
        >
          {parts.join(" и ")}
        </button>
        .
      </p>
    );
  })();

  return (
    <div className="flex flex-col flex-1">
      {/* Stats paragraph with filter link */}
      {filterSummary && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-4">
          {filterSummary}
        </div>
      )}

      {/* Filter modal */}
      {isModalOpen && (
        <HistoryFilterModal
          selectedCategories={selectedCategories}
          selectedSources={selectedSources}
          onApply={handleApplyFilters}
          onClose={handleCloseModal}
        />
      )}

      {/* Full-height map — isolated stacking context so Leaflet layers don't
          bleed outside this container */}
      <div className="flex-1 isolate">
        <HistoryMapWrapper
          categories={selectedCategories}
          sources={selectedSources}
          onStatsLoaded={handleStatsLoaded}
        />
      </div>
    </div>
  );
}
