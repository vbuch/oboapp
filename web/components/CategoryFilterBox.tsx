"use client";

import { useEffect, useRef, useMemo } from "react";
import FilterIcon from "@/components/icons/FilterIcon";
import CategoryIcon from "@/components/CategoryIcon";
import Checkbox from "@/components/Checkbox";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { useDragPanel } from "@/lib/hooks/useDragPanel";
import { borderRadius } from "@/lib/colors";
import {
  CATEGORY_LABELS,
  UNCATEGORIZED,
  UNCATEGORIZED_LABEL,
  Category,
} from "@oboapp/shared";

/**
 * Skeleton placeholder for category filter while loading
 */
function CategoryFilterSkeleton() {
  const widths = ["w-32", "w-28", "w-36", "w-24", "w-40"];
  return (
    <div className="px-4 py-4 space-y-1">
      {widths.map((width, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-2 px-3 animate-pulse"
        >
          <div className="w-4 h-4 bg-neutral-light rounded" />
          <div className={`h-3.5 bg-neutral-light rounded ${width}`} />
        </div>
      ))}
    </div>
  );
}

interface CategoryCount {
  category: Category | typeof UNCATEGORIZED;
  count: number;
}

interface CategoryFilterBoxProps {
  readonly isOpen: boolean;
  readonly selectedCategories: Set<Category | typeof UNCATEGORIZED>;
  readonly categoryCounts: CategoryCount[];
  readonly hasActiveFilters: boolean;
  readonly isInitialLoad: boolean;
  readonly isLoadingCounts: boolean;
  readonly showArchived: boolean;
  readonly onTogglePanel: () => void;
  readonly onToggleCategory: (
    category: Category | typeof UNCATEGORIZED,
  ) => void;
  readonly onToggleShowArchived: () => void;
}

/**
 * Category filter box - slides in/out from left side
 * Shows category checkboxes with counts
 */
export default function CategoryFilterBox({
  isOpen,
  selectedCategories,
  categoryCounts,
  hasActiveFilters,
  isInitialLoad,
  isLoadingCounts,
  showArchived,
  onTogglePanel,
  onToggleCategory,
  onToggleShowArchived,
}: CategoryFilterBoxProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Horizontal drag to open/close functionality
  const { isActuallyDragging, dragOffset, handlers } = useDragPanel({
    direction: "horizontal",
    isOpen,
    bidirectional: true,
    onAction: onTogglePanel,
  });

  // Calculate transform style based on drag state
  const transformStyle = useMemo(() => {
    const translateX = isActuallyDragging
      ? isOpen
        ? `${dragOffset}px`
        : `calc(-100% + ${dragOffset}px)`
      : isOpen
        ? "0"
        : "-100%";

    return {
      transform: `translateX(${translateX}) translateY(-50%)`,
      transitionProperty: isActuallyDragging ? "none" : undefined,
    };
  }, [isActuallyDragging, isOpen, dragOffset]);

  // Close on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onTogglePanel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onTogglePanel]);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm pointer-events-auto sm:hidden"
          onClick={onTogglePanel}
          aria-label="Затвори филтрите"
        />
      )}

      {/* Filter Container - Box and Handle together */}
      <div
        className="absolute left-0 top-1/2 z-20 transition-transform duration-300"
        style={transformStyle}
      >
        {/* Filter Panel */}
        <div
          ref={panelRef}
          className="relative z-20 w-[320px] max-h-[calc(100vh-80px-2rem)] [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:max-h-[450] my-4 bg-white shadow-2xl rounded-r-lg flex flex-col"
        >
          {/* Category List with Archived Toggle - Only show when loaded */}
          {isInitialLoad ? (
            <div className="overflow-y-auto flex-1">
              <CategoryFilterSkeleton />
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <div className="px-4 py-4 space-y-1">
                {categoryCounts.map(({ category, count }) => (
                  <Checkbox
                    key={category}
                    label={
                      category === UNCATEGORIZED
                        ? UNCATEGORIZED_LABEL
                        : CATEGORY_LABELS[category]
                    }
                    checked={selectedCategories.has(category)}
                    onChange={() => onToggleCategory(category)}
                    count={count}
                    isLoadingCount={isLoadingCounts}
                    icon={<CategoryIcon category={category} size={20} />}
                  />
                ))}

                <div className="border-t border-neutral-border pt-3 mt-1">
                  <Checkbox
                    label="Покажи минали"
                    checked={showArchived}
                    onChange={onToggleShowArchived}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Footer with Close Button */}
          <div className="border-t border-neutral-border px-4 py-4 flex justify-end sm:hidden">
            <button
              type="button"
              onClick={onTogglePanel}
              className={`${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.md}`}
            >
              Покажи
            </button>
          </div>
        </div>

        {/* Handle */}
        <button
          type="button"
          onClick={onTogglePanel}
          {...handlers}
          className={[
            "drag-handle absolute right-0 top-1/2 z-40 -translate-y-1/2 translate-x-full rounded-r-lg px-2 py-3 hover:px-3 transition-all duration-200 border border-l-0 border-primary-hover bg-primary text-white cursor-grab active:cursor-grabbing shadow-lg",
          ].join(" ")}
          aria-label={isOpen ? "Затвори филтрите" : "Отвори филтрите"}
        >
          <div className="relative">
            <FilterIcon className="w-5 h-5 text-white" />
            {/* Active Filter Indicator - Red Dot */}
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-white" />
            )}
          </div>
        </button>
      </div>
    </>
  );
}
