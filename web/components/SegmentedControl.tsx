"use client";

import { useCallback } from "react";
import { House } from "lucide-react";

interface SegmentOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

interface SegmentedControlProps {
  readonly options: readonly SegmentOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly homeValue?: string;
  readonly onHomeChange?: (value: string) => void;
  readonly className?: string;
}

/**
 * Pill-shaped segmented control for selecting between mutually exclusive options.
 * Renders as a role="radiogroup" with roving tabIndex and arrow-key navigation
 * per the WAI-ARIA radio group pattern.
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  homeValue,
  onHomeChange,
  className = "",
}: SegmentedControlProps) {
  const enabledOptions = options.filter((o) => !o.disabled);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const { key } = event;
      if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(key)) {
        return;
      }

      event.preventDefault();

      if (enabledOptions.length === 0) {
        return;
      }

      const currentIndex = enabledOptions.findIndex((o) => o.value === value);
      if (currentIndex === -1) {
        return;
      }
      let nextIndex: number;

      if (key === "ArrowRight" || key === "ArrowDown") {
        nextIndex = (currentIndex + 1) % enabledOptions.length;
      } else {
        nextIndex =
          (currentIndex - 1 + enabledOptions.length) % enabledOptions.length;
      }

      const nextOption = enabledOptions[nextIndex];
      onChange(nextOption.value);

      // Move focus to the newly selected radio button
      const target = event.target;
      const radiogroup =
        target instanceof HTMLElement
          ? target.closest("[role='radiogroup']")
          : null;
      const buttons = radiogroup?.querySelectorAll<HTMLButtonElement>(
        "[role='radio']:not([aria-disabled='true'])",
      );
      buttons?.[nextIndex]?.focus();
    },
    [enabledOptions, value, onChange],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Изглед на събитията"
      className={`inline-flex items-center rounded-full border border-neutral-border bg-neutral-light p-1 gap-1 ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = option.disabled === true;
        // Roving tabIndex: only the active (checked) radio is tabbable;
        // disabled buttons are also not tabbable.
        let tabIndex = -1;
        if (!isDisabled && isActive) {
          tabIndex = 0;
        }
        const isHome = homeValue === option.value;
        const homeLabel = isHome
          ? `„${option.label}“ е началният ти изглед`
          : `Направи „${option.label}“ начален изглед`;
        return (
          <div
            key={option.value}
            className={`flex min-w-0 items-center rounded-full ${
              isActive ? "bg-white shadow-sm text-primary" : "text-neutral"
            }`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-disabled={isDisabled || undefined}
              tabIndex={tabIndex}
              onClick={isDisabled ? undefined : () => onChange(option.value)}
              onKeyDown={isDisabled ? undefined : handleKeyDown}
              className={`min-h-10 whitespace-nowrap px-1.5 sm:px-3 py-1.5 rounded-full text-[13px] sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                isDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer hover:text-neutral-dark"
              }`}
            >
              {option.label}
            </button>
            {isActive && !isDisabled && onHomeChange && (
              <button
                type="button"
                aria-label={homeLabel}
                title={homeLabel}
                aria-pressed={isHome}
                onClick={() => {
                  if (!isHome) {
                    onHomeChange(option.value);
                  }
                }}
                className="flex h-10 w-9 shrink-0 items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                <House
                  className="h-4 w-4"
                  fill={isHome ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
