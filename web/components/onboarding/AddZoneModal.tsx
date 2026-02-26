"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_ZONE_COLOR,
  MAX_ZONE_LABEL_LENGTH,
  ZONE_COLOR_OPTIONS,
  ZONE_LABEL_HINTS,
  sanitizeZoneLabel,
} from "@/lib/zoneTypes";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

export interface PendingZone {
  readonly label: string;
  readonly color: string;
}

interface AddZoneModalProps {
  readonly onConfirm: (zone: PendingZone) => void;
  readonly onCancel: () => void;
}

export default function AddZoneModal({
  onConfirm,
  onCancel,
}: AddZoneModalProps) {
  const [labelInput, setLabelInput] = useState("");
  const [selectedColor, setSelectedColor] = useState(DEFAULT_ZONE_COLOR);
  const [showError, setShowError] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  const sanitizedLabel = sanitizeZoneLabel(labelInput);

  useEffect(() => {
    requestAnimationFrame(() => {
      labelInputRef.current?.focus();
    });
  }, []);

  const handleConfirm = () => {
    if (!sanitizedLabel) {
      setShowError(true);
      return;
    }

    onConfirm({ label: sanitizedLabel, color: selectedColor });
  };

  const handleHintClick = (hint: string) => {
    setLabelInput(hint);
    setShowError(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 ${zIndex.modalBackdrop}`}
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <dialog
        open
        aria-labelledby="add-zone-title"
        className={`fixed inset-0 ${zIndex.modalContent} m-0 w-full h-full max-w-none max-h-none p-0 border-0 bg-transparent overflow-visible pointer-events-none`}
        onCancel={(event) => {
          event.preventDefault();
          onCancel();
        }}
      >
        <div className="w-full h-full p-3 sm:p-4 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col gap-5 pointer-events-auto">
            <h2
              id="add-zone-title"
              className="text-base font-semibold text-neutral-dark"
            >
              Детайли за зона
            </h2>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="zone-label"
                className="text-sm font-medium text-neutral-dark"
              >
                Име на зона
              </label>
              <input
                id="zone-label"
                ref={labelInputRef}
                type="text"
                value={labelInput}
                maxLength={MAX_ZONE_LABEL_LENGTH}
                aria-invalid={showError}
                aria-describedby={showError ? "zone-label-error" : undefined}
                onChange={(event) => {
                  setLabelInput(event.target.value);
                  setShowError(false);
                }}
                placeholder="Напр. Вкъщи"
                className={`w-full px-3 py-2 border ${showError ? "border-error-border" : "border-neutral-border"} ${borderRadius.sm} text-sm text-neutral-dark focus:outline-none focus:ring-2 focus:ring-primary/50`}
              />
              <div className="flex flex-wrap gap-2">
                {ZONE_LABEL_HINTS.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => handleHintClick(hint)}
                    className="px-2.5 py-1 rounded-md border border-neutral-border text-xs text-neutral-dark hover:bg-neutral-light"
                  >
                    {hint}
                  </button>
                ))}
              </div>
              {showError && (
                <p id="zone-label-error" className="text-xs text-error">
                  Моля, въведете име на зона.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-neutral-dark">Цвят</p>
              <div className="grid grid-cols-6 gap-2">
                {ZONE_COLOR_OPTIONS.map((option) => {
                  const isSelected = option.color === selectedColor;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedColor(option.color)}
                      aria-label={option.label}
                      aria-pressed={isSelected}
                      title={option.label}
                      className={`w-9 h-9 rounded-full border-2 ${isSelected ? "border-neutral-dark" : "border-neutral-border"}`}
                      style={{ backgroundColor: option.color }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onCancel}
                className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.sm}`}
              >
                Отказ
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.sm}`}
              >
                Запази зона
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
