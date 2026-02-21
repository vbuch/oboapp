"use client";

import { useRouter } from "next/navigation";

/**
 * Reusable back navigation button with consistent styling.
 * Uses router.back() to navigate to previous page in browser history.
 */
interface BackButtonProps {
  readonly label?: string;
}

export default function BackButton({ label = "Назад" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-primary hover:text-primary-hover hover:underline inline-flex items-center gap-2 transition-colors cursor-pointer"
    >
      <span>←</span>
      <span>{label}</span>
    </button>
  );
}
