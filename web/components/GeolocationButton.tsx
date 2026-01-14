"use client";

import { borderRadius } from "@/lib/colors";

interface GeolocationButtonProps {
  readonly onClick: () => void;
  readonly isLocating?: boolean;
  readonly visible?: boolean;
}

export default function GeolocationButton({
  onClick,
  isLocating = false,
  visible = true,
}: GeolocationButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLocating}
      className={`absolute bottom-8 left-8 z-30 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white p-4 ${borderRadius.full} shadow-lg hover:shadow-xl transition-all duration-200 transition-opacity duration-150 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      } ${isLocating ? "cursor-not-allowed" : "cursor-pointer"}`}
      aria-label="Покажи моето местоположение"
      aria-hidden={!visible}
    >
      <svg
        className={`w-5 h-5 ${
          isLocating ? "animate-geolocation-loading-spin" : ""
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M22 12h-4M6 12H2M12 6V2M12 18v4" />
      </svg>
    </button>
  );
}
