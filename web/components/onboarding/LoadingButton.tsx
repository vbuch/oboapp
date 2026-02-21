"use client";

import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

interface LoadingButtonProps {
  readonly visible?: boolean;
}

/**
 * Button shown during loading state with a spinning indicator.
 * Matches the styling of NotificationButton but is non-interactive.
 */
export default function LoadingButton({ visible = true }: LoadingButtonProps) {
  return (
    <button
      type="button"
      disabled
      className={`animate-fade-in absolute bottom-8 right-8 ${zIndex.fixed} ${
        buttonSizes.lg
      } ${buttonStyles.primary} ${
        borderRadius.md
      } shadow-lg flex items-center gap-2 font-medium disabled:opacity-100 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Зарежда се..."
      aria-hidden={!visible}
    >
      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
    </button>
  );
}
