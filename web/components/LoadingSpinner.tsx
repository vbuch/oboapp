"use client";

interface LoadingSpinnerProps {
  readonly size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-12 w-12",
};

export default function LoadingSpinner({ size = "md" }: LoadingSpinnerProps) {
  return (
    <div
      className={`animate-spin rounded-full border-b-2 border-primary ${sizeClasses[size]}`}
      role="status"
      aria-label="Зарежда се"
    />
  );
}
