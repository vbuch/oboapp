import { SVGProps } from "react";

interface FilterIconProps extends SVGProps<SVGSVGElement> {
  readonly className?: string;
}

/**
 * Sliders icon for filter functionality
 */
export default function FilterIcon({ className, ...props }: FilterIconProps) {
  return (
    <svg
      className={className}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      stroke="currentColor"
      {...props}
    >
      {/* Horizontal slider 1 */}
      <line x1="4" y1="6" x2="10" y2="6" />
      <circle cx="12" cy="6" r="2" />
      <line x1="14" y1="6" x2="20" y2="6" />

      {/* Horizontal slider 2 */}
      <line x1="4" y1="12" x2="14" y2="12" />
      <circle cx="16" cy="12" r="2" />
      <line x1="18" y1="12" x2="20" y2="12" />

      {/* Horizontal slider 3 */}
      <line x1="4" y1="18" x2="6" y2="18" />
      <circle cx="8" cy="18" r="2" />
      <line x1="10" y1="18" x2="20" y2="18" />
    </svg>
  );
}
