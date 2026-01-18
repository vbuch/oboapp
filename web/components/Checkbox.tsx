"use client";

import { useId } from "react";

interface CheckboxProps {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly count?: number;
  readonly isLoadingCount?: boolean;
  readonly disabled?: boolean;
}

/**
 * Reusable checkbox component with label and optional count
 */
export default function Checkbox({
  label,
  checked,
  onChange,
  count,
  isLoadingCount = false,
  disabled = false,
}: CheckboxProps) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-neutral-light active:bg-neutral-border"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 text-primary border-neutral-border rounded focus:ring-2 focus:ring-primary focus:ring-offset-1 cursor-pointer disabled:cursor-not-allowed"
      />
      <span className="flex-1 text-sm text-foreground">{label}</span>
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
    </label>
  );
}
