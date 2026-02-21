"use client";

interface SegmentOption {
  readonly value: string;
  readonly label: string;
}

interface SegmentedControlProps {
  readonly options: readonly SegmentOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly className?: string;
}

/**
 * Pill-shaped segmented control for selecting between mutually exclusive options.
 * Renders as a role="radiogroup" for accessibility.
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      className={`inline-flex items-center rounded-full border border-neutral-border bg-neutral-light p-1 gap-1 ${className}`}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              isActive
                ? "bg-white shadow-sm text-primary"
                : "text-neutral hover:text-neutral-dark"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
