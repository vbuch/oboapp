import React from "react";
import { CATEGORY_LABELS, Category } from "@/lib/category-constants";

interface CategoriesProps {
  readonly categories?: string[];
}

function isCategory(value: string): value is Category {
  return value in CATEGORY_LABELS;
}

export default function Categories({ categories }: CategoriesProps) {
  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <span
          key={category}
          className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full border border-primary/20"
        >
          {isCategory(category) ? CATEGORY_LABELS[category] : category}
        </span>
      ))}
    </div>
  );
}
