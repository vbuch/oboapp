/**
 * Theme utilities for OboApp
 * Provides consistent button styles using theme colors from colors.ts
 */

import { borderRadius } from "./colors";

/**
 * Button style variants using Tailwind theme colors
 * 
 * Colors are defined in globals.css @theme inline and sourced from colors.ts:
 * - Primary buttons: colors.interaction.circle (#1976D2) - consistent with interactive UI elements
 * - Destructive buttons: colors.primary.red (#E74C3C) and redDark - for destructive actions
 * - Secondary/Warning: Standard Tailwind grays and yellows for neutral states
 */
export const buttonStyles = {
  /** Primary action button - uses theme primary color */
  primary:
    "bg-primary hover:bg-primary-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Destructive action button - uses theme destructive color */
  destructive:
    "bg-destructive hover:bg-destructive-hover text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Secondary action button - gray background */
  secondary:
    "bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Warning action button - yellow background */
  warning:
    "bg-yellow-200 hover:bg-yellow-300 text-yellow-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Ghost button - no background, with border */
  ghost:
    "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  /** Link-style button - uses theme primary color */
  link: "text-primary hover:text-primary-hover hover:underline",
  /** Destructive link-style button - uses theme destructive color */
  linkDestructive: "text-destructive hover:text-destructive-hover hover:underline",
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
 * 
 * @param variant - Button style variant (default: "primary")
 * @param size - Button size (default: "md")
 * @param radius - Border radius (default: "sm" which is rounded-md, the most common button radius)
 * @param additionalClasses - Additional Tailwind classes
 * @returns Combined className string
 * 
 * Note: Most buttons use borderRadius.sm (rounded-md). Use borderRadius.md (rounded-lg) 
 * for larger, more prominent buttons like those in prompts and dialogs.
 */
export function getButtonClasses(
  variant: keyof typeof buttonStyles = "primary",
  size: keyof typeof buttonSizes = "md",
  radius: keyof typeof borderRadius = "sm",
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
