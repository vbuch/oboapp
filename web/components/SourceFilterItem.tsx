"use client";

import { Check } from "lucide-react";

interface SourceFilterItemProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly count: number;
  readonly isLoadingCount: boolean;
}

/**
 * Individual source filter item with checkbox-like button
 * Matches the style of CategoryFilterItem but without icon and colored border
 */
export default function SourceFilterItem({
  label,
  checked,
  onChange,
  count,
  isLoadingCount,
}: SourceFilterItemProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      aria-pressed={checked}
      className={`w-full flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
        checked ? "bg-neutral-light hover:bg-neutral-border" : "bg-transparent hover:bg-neutral-light"
      }`}
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: checked ? "#6B7280" : "transparent", // neutral-500 for checked state
      }}
      aria-label={`${checked ? "Премахни" : "Филтрирай"} ${label}`}
    >
      {/* Label - same as CategoryFilterItem */}
      <span className="flex-1 text-left text-sm text-foreground">{label}</span>

      {/* Count Badge - same style as CategoryFilterItem */}
      {count !== undefined && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            isLoadingCount
              ? "bg-neutral-light animate-pulse w-8"
              : "text-neutral bg-neutral-light"
          }`}
        >
          {isLoadingCount ? "\u00A0" : count}
        </span>
      )}

      {/* Checkmark - same as CategoryFilterItem but without color */}
      {checked && <Check size={18} strokeWidth={2.5} className="text-neutral" />}
    </button>
  );
}
