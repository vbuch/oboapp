"use client";

import { Check } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import { CATEGORY_STYLES } from "@/lib/category-styles";
import { Category, UNCATEGORIZED } from "@oboapp/shared";

interface CategoryFilterItemProps {
  readonly category: Category | typeof UNCATEGORIZED;
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: () => void;
  readonly count?: number;
  readonly isLoadingCount?: boolean;
}

/**
 * Category filter item - button style with colored border when selected
 * Shows category icon, label, count badge, and checkmark when selected
 */
export default function CategoryFilterItem({
  category,
  label,
  checked,
  onChange,
  count,
  isLoadingCount = false,
}: CategoryFilterItemProps) {
  const style = CATEGORY_STYLES[category];

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
        borderColor: checked ? style.color : "transparent",
      }}
    >
      <CategoryIcon category={category} size={20} showBackground={checked} />
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
      {checked && (
        <Check size={18} strokeWidth={2.5} style={{ color: style.color }} />
      )}
    </button>
  );
}
