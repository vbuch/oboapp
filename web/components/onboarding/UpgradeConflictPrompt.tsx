"use client";

import { useEffect, useRef } from "react";
import { zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes, borderRadius } from "@/lib/theme";
import type { UpgradeDecisionOption } from "@/lib/auth-upgrade";

interface UpgradeConflictPromptProps {
  readonly isLoading: boolean;
  readonly onSelect: (option: UpgradeDecisionOption) => void;
}

export default function UpgradeConflictPrompt({
  isLoading,
  onSelect,
}: UpgradeConflictPromptProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstActionRef.current?.focus();
  }, []);

  return (
    <>
      <div
        className={`fixed inset-0 ${zIndex.modalBackdrop} bg-black/20 backdrop-blur-sm`}
        aria-hidden="true"
      />

      <div
        className={`animate-fade-in fixed inset-0 flex items-center justify-center p-4 ${zIndex.modalContent} pointer-events-none`}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-conflict-title"
          className="pointer-events-auto w-full max-w-md bg-white rounded-lg shadow-xl p-6"
        >
          <h2
            id="upgrade-conflict-title"
            className="text-xl font-semibold text-foreground mb-3"
          >
            Как да използваме данните ти?
          </h2>
          <p className="text-neutral mb-6">
            Открихме данни от гост режим и от профила ти. Избери как да
            продължим.
          </p>

          <div className="space-y-3">
            <button
              ref={firstActionRef}
              type="button"
              disabled={isLoading}
              onClick={() => onSelect("import")}
              className={`${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.sm} w-full`}
            >
              Импортирай
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onSelect("keepSeparate")}
              className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.sm} w-full`}
            >
              Запази отделно
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => onSelect("replace")}
              className={`${buttonSizes.md} ${buttonStyles.destructive} ${borderRadius.sm} w-full`}
            >
              Замени
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
