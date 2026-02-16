"use client";

import { trackEvent } from "@/lib/analytics";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import PlusIcon from "@/components/icons/PlusIcon";

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
      type="button"
      onClick={handleClick}
      className={`animate-fade-in absolute bottom-8 right-8 ${zIndex.fixed} ${
        buttonSizes.lg
      } ${buttonStyles.primary} ${
        borderRadius.md
      } shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      aria-label="Добави зона"
      aria-hidden={!visible}
    >
      <PlusIcon className="w-5 h-5" />
      Добави зона
    </button>
  );
}
