"use client";

import React from "react";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

interface PromptCardProps {
  readonly icon?: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly note?: string;
  readonly primaryButton?: {
    readonly text: string;
    readonly onClick: () => void;
  };
  readonly secondaryButton?: {
    readonly text: string;
    readonly onClick: () => void;
  };
}

export default function PromptCard({
  icon,
  title,
  description,
  note,
  primaryButton,
  secondaryButton,
}: PromptCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-6">
      <div className="flex items-start gap-3 sm:gap-4">
        {icon && (
          <div className="flex-shrink-0 w-9 h-9 sm:w-12 sm:h-12 [&>svg]:w-full [&>svg]:h-full">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
            {description}
          </p>
          {note && <p className="text-xs text-gray-500 mb-3 sm:mb-4">{note}</p>}
          {(primaryButton || secondaryButton) && (
            <div className="flex gap-2 sm:gap-3">
              {secondaryButton && (
                <button
                  type="button"
                  onClick={secondaryButton.onClick}
                  className={`flex-1 ${buttonSizes.md} font-medium ${buttonStyles.secondary} ${borderRadius.sm}`}
                >
                  {secondaryButton.text}
                </button>
              )}
              {primaryButton && (
                <button
                  type="button"
                  onClick={primaryButton.onClick}
                  className={`flex-1 ${buttonSizes.md} font-medium ${buttonStyles.primary} ${borderRadius.sm}`}
                >
                  {primaryButton.text}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
