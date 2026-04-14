"use client";

import { useEffect, useId, useRef } from "react";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonSizes, buttonStyles } from "@/lib/theme";

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly description?: string;
  readonly confirmText: string;
  readonly confirmingText?: string;
  readonly cancelText?: string;
  readonly isConfirming?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmText,
  confirmingText = "Обработване...",
  cancelText = "Отказ",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleCancel = () => {
    if (isConfirming) {
      return;
    }

    onCancel();
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousActive = document.activeElement;
    previousFocusRef.current =
      previousActive instanceof HTMLElement ? previousActive : null;

    requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    globalThis.window.addEventListener("keydown", handleKeyDown);

    return () => {
      globalThis.window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 ${zIndex.modalBackdrop}`}
        onClick={handleCancel}
        aria-hidden="true"
      />

      <dialog
        ref={dialogRef}
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`fixed inset-0 ${zIndex.modalContent} m-0 w-full h-full max-w-none max-h-none p-0 border-0 bg-transparent overflow-visible pointer-events-none`}
        onCancel={(event) => {
          event.preventDefault();
          handleCancel();
        }}
      >
        <div className="w-full h-full p-3 sm:p-4 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4 pointer-events-auto">
            <h2
              id={titleId}
              className="text-base font-semibold text-neutral-dark"
            >
              {title}
            </h2>

            {description ? (
              <p id={descriptionId} className="text-sm text-neutral-dark">
                {description}
              </p>
            ) : null}

            <div className="flex gap-3 justify-end">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleCancel}
                disabled={isConfirming}
                className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.sm}`}
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isConfirming}
                className={`${buttonSizes.md} ${buttonStyles.destructive} ${borderRadius.sm}`}
              >
                {isConfirming ? confirmingText : confirmText}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
