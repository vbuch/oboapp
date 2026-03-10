"use client";

import { ReactNode } from "react";
import Accordion from "@/components/Accordion";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

interface FilterSectionProps {
  readonly title: string;
  readonly description: string;
  readonly hasActiveFilters: boolean;
  readonly allSelected: boolean;
  readonly onSelectAll: () => void;
  readonly onDeselectAll: () => void;
  readonly children: ReactNode;
}

/**
 * Reusable filter section with accordion toggle, description, and select/deselect all controls.
 * Shows a red dot indicator on the accordion header when closed and has active filters.
 */
export default function FilterSection({
  title,
  description,
  hasActiveFilters,
  allSelected,
  onSelectAll,
  onDeselectAll,
  children,
}: FilterSectionProps) {
  const actionButtonClasses = `text-xs ${buttonStyles.ghost} ${buttonSizes.sm} ${borderRadius.sm}`;
  return (
    <Accordion title={title} hasActiveFilters={hasActiveFilters}>
      <div className="px-4 pt-2 pb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className={actionButtonClasses}
          >
            Избери всички
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            disabled={!hasActiveFilters}
            className={actionButtonClasses}
          >
            Изчисти всички
          </button>
        </div>
        <p className="text-sm text-neutral mb-3">{description}</p>
        <div className="space-y-1">{children}</div>
      </div>
    </Accordion>
  );
}
