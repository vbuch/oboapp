import { ReactNode } from "react";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly clickable?: boolean;
  readonly onClick?: () => void;
}

/**
 * Shared card component with consistent styling across the application.
 * Provides the standard white background, shadow, border, and optional hover effects.
 */
export default function Card({
  children,
  className = "",
  clickable = false,
  onClick,
}: CardProps) {
  const baseClasses =
    "bg-white rounded-lg shadow-md p-6 border border-neutral-border";
  const interactiveClasses = clickable
    ? "hover:shadow-lg transition-shadow cursor-pointer"
    : "";

  const combinedClasses =
    `${baseClasses} ${interactiveClasses} ${className}`.trim();

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${combinedClasses} w-full text-left`}
        type="button"
      >
        {children}
      </button>
    );
  }

  return <div className={combinedClasses}>{children}</div>;
}
