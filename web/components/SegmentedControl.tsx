"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import { House } from "lucide-react";
import styles from "./SegmentedControl.module.css";

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
  const groupRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const enabledOptions = options.filter((o) => !o.disabled);

  useLayoutEffect(() => {
    const group = groupRef.current;
    const indicator = indicatorRef.current;
    if (!group || !indicator) {
      return;
    }

    const activeSegment = group.querySelector<HTMLElement>('[data-active="true"]');
    if (!activeSegment) {
      delete group.dataset.indicatorReady;
      return;
    }

    const updateIndicator = () => {
      const groupBounds = group.getBoundingClientRect();
      const segmentBounds = activeSegment.getBoundingClientRect();
      indicator.style.setProperty(
        "--selection-x",
        `${segmentBounds.left - groupBounds.left - group.clientLeft}px`,
      );
      indicator.style.setProperty(
        "--selection-y",
        `${segmentBounds.top - groupBounds.top - group.clientTop}px`,
      );
      indicator.style.setProperty("--selection-width", `${segmentBounds.width}px`);
      indicator.style.setProperty("--selection-height", `${segmentBounds.height}px`);
      group.dataset.indicatorReady = "true";
    };

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(group);
    for (const segment of group.querySelectorAll<HTMLElement>("[data-active]")) {
      observer.observe(segment);
    }
    return () => {
      observer.disconnect();
    };
  }, [options, value, onHomeChange]);

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
      ref={groupRef}
      role="radiogroup"
      aria-label="Изглед на събитията"
      data-slot="segmented-control"
      className={`${styles.control} relative isolate inline-flex items-center rounded-full border border-neutral-border bg-neutral-light p-1 gap-1 ${className}`}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        data-slot="selection-indicator"
        className={`${styles.indicator} pointer-events-none absolute left-0 top-0 rounded-full bg-white shadow-sm`}
      />
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
        const hasHomeAction = isActive && !isDisabled && Boolean(onHomeChange);
        const homeLabel = isHome
          ? `„${option.label}“ е началният ти изглед`
          : `Направи „${option.label}“ начален изглед`;
        return (
          <div
            key={option.value}
            data-active={isActive}
            data-disabled={isDisabled || undefined}
            className={`${styles.segment} relative flex min-w-0 items-center rounded-full ${
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
              className={`min-h-10 whitespace-nowrap py-1.5 rounded-full text-[13px] sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                hasHomeAction ? "pl-1.5 pr-0 sm:pl-3" : "px-1.5 sm:px-3"
              } ${
                isDisabled
                  ? "opacity-40 cursor-not-allowed"
                  : "cursor-pointer"
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
