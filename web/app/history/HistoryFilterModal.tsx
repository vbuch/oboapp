"use client";

import { useState, useEffect, useRef } from "react";
import {
  CATEGORIES,
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_LABELS,
  UNCATEGORIZED,
  UNCATEGORIZED_LABEL,
  type Category,
} from "@oboapp/shared";
import CategoryFilterItem from "@/components/CategoryFilterItem";
import SourceFilterItem from "@/components/SourceFilterItem";
import Accordion from "@/components/Accordion";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";
import { getCurrentLocalitySources } from "@/lib/source-utils";

const orderedCategories: (Category | typeof UNCATEGORIZED)[] = [
  ...CATEGORY_DISPLAY_ORDER.filter((c) => CATEGORIES.includes(c)),
  UNCATEGORIZED,
];

interface HistoryFilterModalProps {
  readonly selectedCategories: Set<string>;
  readonly selectedSources: Set<string>;
  readonly onApply: (
    categories: Set<string>,
    sources: Set<string>,
  ) => void;
  readonly onClose: () => void;
}

/**
 * Modal for filtering the history heatmap by categories and sources.
 */
export default function HistoryFilterModal({
  selectedCategories,
  selectedSources,
  onApply,
  onClose,
}: HistoryFilterModalProps) {
  const [localCategories, setLocalCategories] = useState(
    () => new Set(selectedCategories),
  );
  const [localSources, setLocalSources] = useState(
    () => new Set(selectedSources),
  );

  const sources = getCurrentLocalitySources();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Focus management: move focus into dialog, trap Tab, Escape to close,
  // restore focus to the triggering element on unmount.
  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;

    firstFocusableRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));

      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    globalThis.window.addEventListener("keydown", handleKeydown);
    return () => {
      globalThis.window.removeEventListener("keydown", handleKeydown);
      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [onClose]);

  const hasActiveCategories = localCategories.size > 0;
  const hasActiveSources = localSources.size > 0;
  const hasActiveFilters = hasActiveCategories || hasActiveSources;

  function toggleCategory(category: string) {
    setLocalCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function toggleSource(sourceId: string) {
    setLocalSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  }

  function handleClearAll() {
    setLocalCategories(new Set());
    setLocalSources(new Set());
  }

  function handleApply() {
    onApply(localCategories, localSources);
  }

  return (
    <>
      {/* Backdrop — z-[1000] ensures it sits above the Leaflet heatmap canvas (z-400) */}
      <button
        type="button"
        className="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Затвори филтрите"
      />

      {/* Modal — z-[1001] sits above the backdrop */}
      <div
        className="fixed inset-0 flex items-center justify-center p-4 z-[1001] pointer-events-none"
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-filter-title"
          className="pointer-events-auto w-full max-w-sm bg-white rounded-lg shadow-xl flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-border">
            <h2
              id="history-filter-title"
              className="text-base font-semibold text-neutral-dark"
            >
              Филтри
            </h2>
            <button
              ref={firstFocusableRef}
              type="button"
              onClick={onClose}
              className="text-neutral hover:text-neutral-dark transition-colors p-1 hover:bg-neutral-light rounded-full"
              aria-label="Затвори"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Filter lists */}
          <div className="overflow-y-auto flex-1">
            <Accordion
              title="Категории"
              defaultOpen={true}
              hasActiveFilters={hasActiveCategories}
            >
              <div className="px-4 space-y-1">
                {orderedCategories.map((category) => (
                  <CategoryFilterItem
                    key={category}
                    category={category}
                    label={
                      category === UNCATEGORIZED
                        ? UNCATEGORIZED_LABEL
                        : CATEGORY_LABELS[category]
                    }
                    checked={localCategories.has(category)}
                    onChange={() => toggleCategory(category)}
                  />
                ))}
              </div>
            </Accordion>

            <Accordion
              title="Източници"
              defaultOpen={false}
              hasActiveFilters={hasActiveSources}
            >
              <div className="px-4 space-y-1">
                {sources.map((source) => (
                  <SourceFilterItem
                    key={source.id}
                    label={source.name}
                    checked={localSources.has(source.id)}
                    onChange={() => toggleSource(source.id)}
                  />
                ))}
              </div>
            </Accordion>
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-border px-5 py-4 flex gap-3">
            <button
              type="button"
              onClick={handleClearAll}
              className={`flex-1 ${buttonSizes.md} ${buttonStyles.ghost} ${borderRadius.sm} ${hasActiveFilters ? "" : "invisible"}`}
            >
              Изчисти всички
            </button>
            <button
              type="button"
              onClick={handleApply}
              className={`flex-1 ${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.sm}`}
            >
              Приложи
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
