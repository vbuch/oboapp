"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Reusable back navigation button/link with consistent styling.
 * When `href` is provided, renders a Link to that URL.
 * Otherwise, uses router.back() to navigate to the previous page in browser history.
 */
interface BackButtonProps {
  readonly label?: string;
  readonly href?: string;
}

const BACK_BUTTON_CLASS =
  "text-primary hover:text-primary-hover inline-flex items-center gap-2 transition-colors cursor-pointer";

export default function BackButton({
  label = "Назад",
  href,
}: BackButtonProps) {
  const router = useRouter();

  const content = (
    <>
      <span>←</span>
      <span>{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={BACK_BUTTON_CLASS}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={BACK_BUTTON_CLASS}
    >
      {content}
    </button>
  );
}
