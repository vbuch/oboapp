"use client";

import type { Interest } from "@/lib/types";
import { ZONE_TYPES } from "@/lib/zoneTypes";

interface ZoneListProps {
  readonly interests: readonly Interest[];
  readonly onZoneClick?: (interest: Interest) => void;
}

/** Fallback colour when interest has no colour assigned. */
const DEFAULT_COLOR = "#6B7280";

/**
 * Renders the user's saved interest zones as a compact list.
 * Shown in the sidebar when "Моите зони" is selected.
 */
export default function ZoneList({ interests, onZoneClick }: ZoneListProps) {
  if (interests.length === 0) {
    return (
      <div className="text-center text-neutral py-8">
        Нямате добавени зони. Натиснете &ldquo;Добави зона&rdquo;, за да
        започнете.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2" role="list">
      {interests.map((interest) => {
        const color = interest.color ?? DEFAULT_COLOR;
        const label =
          interest.label ??
          ZONE_TYPES.find((t) => t.color === interest.color)?.label ??
          "Зона";

        return (
          <li key={interest.id}>
            <button
              type="button"
              onClick={() => onZoneClick?.(interest)}
              className="w-full flex items-center gap-3 rounded-lg border border-neutral-border bg-white p-3 text-left transition-colors hover:bg-neutral-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span
                className="w-8 h-8 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-neutral-dark truncate">
                  {label}
                </span>
                <span className="text-xs text-neutral">
                  {interest.radius} м радиус
                </span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
