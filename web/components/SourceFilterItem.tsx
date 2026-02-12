"use client";

import { Check } from "lucide-react";
import { borderRadius } from "@/lib/colors";

interface SourceFilterItemProps {
  readonly sourceId: string;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly count: number;
  readonly isLoadingCount: boolean;
}

/**
 * Individual source filter item with checkbox-like button
 */
export default function SourceFilterItem({
  sourceId,
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
      className={`
        w-full flex items-center gap-3 py-2 px-3 transition-colors
        ${borderRadius.md}
        ${
          checked
            ? "bg-primary/10 hover:bg-primary/15"
            : "hover:bg-neutral-light"
        }
      `}
      aria-label={`${checked ? "Премахни" : "Филтрирай"} ${label}`}
      aria-pressed={checked}
    >
      {/* Checkbox */}
      <div
        className={`
          w-4 h-4 flex-shrink-0 flex items-center justify-center border-2 transition-all
          ${borderRadius.sm}
          ${
            checked
              ? "bg-primary border-primary"
              : "bg-white border-neutral-border"
          }
        `}
      >
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>

      {/* Label */}
      <span className="flex-1 text-left text-sm font-normal text-neutral-dark">
        {label}
      </span>

      {/* Count Badge */}
      {isLoadingCount ? (
        <div className="w-8 h-5 bg-neutral-light rounded-full animate-pulse" />
      ) : (
        <span
          className={`
            px-2 py-0.5 text-xs font-medium rounded-full min-w-[2rem] text-center
            ${
              checked
                ? "bg-primary text-white"
                : "bg-neutral-light text-neutral-dark"
            }
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}
