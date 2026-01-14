"use client";

import { trackEvent } from "@/lib/analytics";
import { borderRadius } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

interface AddInterestButtonProps {
  readonly onClick: () => void;
  readonly isUserAuthenticated?: boolean;
  readonly visible?: boolean;
}

export default function AddInterestButton({
  onClick,
  isUserAuthenticated = false,
  visible = true,
}: AddInterestButtonProps) {
  const handleClick = () => {
    trackEvent({
      name: "zone_add_initiated",
      params: { user_authenticated: isUserAuthenticated },
    });
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`absolute bottom-8 right-8 z-30 ${buttonSizes.lg} ${buttonStyles.primary} ${borderRadius.md} shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Добави зона"
      aria-hidden={!visible}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M12 4v16m8-8H4"></path>
      </svg>
      Добави зона
    </button>
  );
}
