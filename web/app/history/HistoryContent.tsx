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
 * Renders the description paragraph (with a clickable "filters" link), the
 * filter modal, and the map.
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

  function handleApplyFilters(
    categories: Set<string>,
    sources: Set<string>,
  ) {
    setSelectedCategories(categories);
    setSelectedSources(sources);
    setIsModalOpen(false);
  }

  // Inline description rendered as part of the surrounding <p> element
  const filterSummary = (() => {
    if (!stats) return null;

    const oldestFormatted = stats.oldestDate
      ? formatDate(stats.oldestDate)
      : null;

    if (!hasActiveFilters) {
      return (
        <>
          {" "}
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
        </>
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
        `${selectedSources.size} ${selectedSources.size === 1 ? "извор" : "извора"}`,
      );
    }

    return (
      <>
        {" "}
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
      </>
    );
  })();

  return (
    <>
      {filterSummary}

      {isModalOpen && (
        <HistoryFilterModal
          selectedCategories={selectedCategories}
          selectedSources={selectedSources}
          onApply={handleApplyFilters}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Full-height map */}
      <div className="flex-1 mt-8">
        <HistoryMapWrapper
          categories={selectedCategories}
          sources={selectedSources}
          onStatsLoaded={handleStatsLoaded}
        />
      </div>
    </>
  );
}
