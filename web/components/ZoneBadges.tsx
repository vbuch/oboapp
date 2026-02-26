"use client";

import type { Interest } from "@/lib/types";
import { colors } from "@/lib/colors";
import PlusIcon from "@/components/icons/PlusIcon";
import { getButtonClasses } from "@/lib/theme";

interface ZoneBadgesProps {
  readonly interests: readonly Interest[];
  readonly onAddZone: () => void;
  readonly addZoneDisabled?: boolean;
  readonly onZoneClick?: (interest: Interest) => void;
}

/** Fallback colour when interest has no colour assigned. */
const DEFAULT_COLOR = colors.primary.grey;

/**
 * Renders the user's saved interest zones as inline badges.
 * Shown on mobile instead of the segmented control.
 */
export default function ZoneBadges({
  interests,
  onAddZone,
  addZoneDisabled = false,
  onZoneClick,
}: ZoneBadgesProps) {
  const addZoneButtonClasses = getButtonClasses(
    "primary",
    "sm",
    "sm",
    "inline-flex items-center gap-1 text-xs font-medium",
  );

  if (interests.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral">Нямате добавени зони.</span>
        <button
          type="button"
          onClick={onAddZone}
          disabled={addZoneDisabled}
          className={addZoneButtonClasses}
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
        const label = interest.label || "Зона";

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
        disabled={addZoneDisabled}
        className={addZoneButtonClasses}
        aria-label="Добави зона"
      >
        <PlusIcon className="w-3 h-3" />
      </button>
    </div>
  );
}
