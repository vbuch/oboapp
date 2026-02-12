"use client";

import { useState, ReactNode, useId } from "react";
import { ChevronDown } from "lucide-react";
import { borderRadius } from "@/lib/colors";

interface AccordionProps {
  readonly title: string;
  readonly defaultOpen?: boolean;
  readonly hasActiveFilters?: boolean;
  readonly children: ReactNode;
}

/**
 * Accordion component for collapsible sections
 * Shows a red dot indicator when closed and has active filters
 */
export default function Accordion({
  title,
  defaultOpen = false,
  hasActiveFilters = false,
  children,
}: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  const titleId = useId();

  return (
    <div className="border-b border-neutral-border last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between py-3 px-4 hover:bg-neutral-light/50 transition-colors cursor-pointer ${borderRadius.md}`}
        aria-expanded={isOpen}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-2">
          <span id={titleId} className="text-sm font-medium text-neutral-dark">
            {title}
          </span>
          {/* Red dot indicator when accordion is closed and has active filters */}
          {!isOpen && hasActiveFilters && (
            <span className="w-2 h-2 bg-error rounded-full" />
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-neutral transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div
          id={contentId}
          role="region"
          aria-labelledby={titleId}
          className="pb-2"
        >
          {children}
        </div>
      )}
    </div>
  );
}
