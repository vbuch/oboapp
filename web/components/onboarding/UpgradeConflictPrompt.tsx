"use client";

import { useEffect, useRef } from "react";
import { zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes, borderRadius } from "@/lib/theme";
import type { UpgradeDecisionOption } from "@/lib/auth-upgrade";

interface UpgradeConflictPromptProps {
  readonly isLoading: boolean;
  readonly onSelect: (option: UpgradeDecisionOption) => void;
  readonly onClose?: () => void;
  readonly returnFocusElement?: HTMLElement | null;
}

export default function UpgradeConflictPrompt({
  isLoading,
  onSelect,
  onClose,
  returnFocusElement,
}: UpgradeConflictPromptProps) {
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocusedElement = document.activeElement;

    firstActionRef.current?.focus();

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose && !isLoading) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusableElements.length === 0) {
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    globalThis.window.addEventListener("keydown", handleKeydown);

    return () => {
      globalThis.window.removeEventListener("keydown", handleKeydown);
      if (returnFocusElement instanceof HTMLElement) {
        returnFocusElement.focus();
        return;
      }

      if (previouslyFocusedElement instanceof HTMLElement) {
        previouslyFocusedElement.focus();
      }
    };
  }, [isLoading, onClose, returnFocusElement]);

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
          ref={dialogRef}
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
