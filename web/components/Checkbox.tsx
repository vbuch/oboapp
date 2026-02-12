"use client";

import { Check } from "lucide-react";
import { borderRadius } from "@/lib/colors";

interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly count?: number;
  readonly isLoadingCount?: boolean;
  readonly disabled?: boolean;
  readonly icon?: React.ReactNode;
}

/**
 * Reusable checkbox component with label and optional count
 * Uses custom checkbox styling to match filter items
 */
export default function Checkbox({
  label,
  checked,
  onChange,
  count,
  isLoadingCount = false,
  disabled = false,
  icon,
}: CheckboxProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`w-full flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-neutral-light active:bg-neutral-border"
      }`}
    >
      {/* Custom Checkbox */}
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
      
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="flex-1 text-left text-sm text-foreground">{label}</span>
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
    </button>
  );
}
