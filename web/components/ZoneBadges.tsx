"use client";

import type { Interest } from "@/lib/types";
import { ZONE_TYPES } from "@/lib/zoneTypes";
import PlusIcon from "@/components/icons/PlusIcon";

interface ZoneBadgesProps {
  readonly interests: readonly Interest[];
  readonly onAddZone: () => void;
  readonly onZoneClick?: (interest: Interest) => void;
}

/** Fallback colour when interest has no colour assigned. */
const DEFAULT_COLOR = "#6B7280";

/**
 * Renders the user's saved interest zones as inline badges.
 * Shown on mobile instead of the segmented control.
 */
export default function ZoneBadges({
  interests,
  onAddZone,
  onZoneClick,
}: ZoneBadgesProps) {
  if (interests.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral">Нямате добавени зони.</span>
        <button
          type="button"
          onClick={onAddZone}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <PlusIcon className="w-3 h-3" />
          Добави зона
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {interests.map((interest) => {
        const color = interest.color ?? DEFAULT_COLOR;
        const label =
          interest.label ??
          ZONE_TYPES.find((t) => t.color === interest.color)?.label ??
          "Зона";

        return (
          <button
            key={interest.id}
            type="button"
            onClick={() => onZoneClick?.(interest)}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80"
            style={{
              borderColor: color,
              backgroundColor: `${color}15`,
              color,
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            {label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddZone}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-neutral-border px-2 py-1 text-xs text-neutral transition-colors hover:border-primary hover:text-primary"
        aria-label="Добави зона"
      >
        <PlusIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
