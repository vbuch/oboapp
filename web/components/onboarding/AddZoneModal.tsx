"use client";

import { useState } from "react";
import { ZONE_TYPES } from "@/lib/zoneTypes";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";

const MIN_RADIUS = 100;
const MAX_RADIUS = 1000;
const DEFAULT_RADIUS = 500;

export interface PendingZone {
  readonly label: string;
  readonly color: string;
  readonly radius: number;
}

interface AddZoneModalProps {
  readonly onConfirm: (zone: PendingZone) => void;
  readonly onCancel: () => void;
}

export default function AddZoneModal({ onConfirm, onCancel }: AddZoneModalProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(ZONE_TYPES[0].id);
  const [radius, setRadius] = useState(DEFAULT_RADIUS);

  const handleConfirm = () => {
    const zoneType = ZONE_TYPES.find((t) => t.id === selectedTypeId) ?? ZONE_TYPES[0];
    onConfirm({ label: zoneType.label, color: zoneType.color, radius });
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-zone-title"
        className={`fixed inset-0 flex items-center justify-center ${zIndex.modalContent} p-4`}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 flex flex-col gap-5">
          <h2
            id="add-zone-title"
            className="text-base font-semibold text-neutral-dark"
          >
            Добави зона
          </h2>

          {/* Zone type grid */}
          <div className="grid grid-cols-3 gap-2">
            {ZONE_TYPES.map((type) => {
              const isSelected = type.id === selectedTypeId;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedTypeId(type.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    isSelected
                      ? "border-[var(--color-primary)] bg-neutral-light"
                      : "border-neutral-border bg-white hover:bg-neutral-light"
                  }`}
                >
                  <span
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium text-neutral-dark leading-tight text-center">
                    {type.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Radius slider */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label
                htmlFor="zone-radius"
                className="text-sm font-medium text-neutral-dark"
              >
                Радиус
              </label>
              <span className="text-sm text-neutral">{radius} м</span>
            </div>
            <input
              id="zone-radius"
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              step={50}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-xs text-neutral">
              <span>{MIN_RADIUS} м</span>
              <span>{MAX_RADIUS} м</span>
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
              Избери на картата
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
