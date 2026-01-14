/**
 * Theme utilities for OboApp
 * Provides consistent button styles and class names
 */

import { borderRadius } from "./colors";

/**
 * Button style variants
 */
export const buttonStyles = {
  /** Primary action button - blue background */
  primary:
    "bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Destructive action button - red background */
  destructive:
    "bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Secondary action button - gray background */
  secondary:
    "bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors disabled:opacity-50",
  /** Ghost button - no background */
  ghost: "bg-transparent hover:bg-gray-100 text-gray-700 transition-colors",
  /** Link-style button */
  link: "text-blue-600 hover:text-blue-700 hover:underline",
  /** Destructive link-style button */
  linkDestructive: "text-red-600 hover:text-red-700 hover:underline",
} as const;

/**
 * Button size variants
 */
export const buttonSizes = {
  /** Small button */
  sm: "px-3 py-1.5 text-sm",
  /** Medium button */
  md: "px-4 py-2 text-sm",
  /** Large button */
  lg: "px-6 py-4 text-base",
} as const;

/**
 * Helper function to combine button classes
 */
export function getButtonClasses(
  variant: keyof typeof buttonStyles = "primary",
  size: keyof typeof buttonSizes = "md",
  radius: keyof typeof borderRadius = "md",
  additionalClasses = ""
): string {
  const classes = [
    buttonStyles[variant],
    buttonSizes[size],
    borderRadius[radius],
    additionalClasses,
  ]
    .filter(Boolean)
    .join(" ");
  return classes;
}

/**
 * Export individual components for flexibility
 */
export { borderRadius };
