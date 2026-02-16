"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { borderRadius, zIndex } from "@/lib/colors";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import LocationPinIcon from "@/components/icons/LocationPinIcon";
import PlusIcon from "@/components/icons/PlusIcon";

interface AddInterestsPromptProps {
  /** Called when user clicks the add zone button */
  readonly onAddInterests: () => void;
  /** Called when user dismisses the prompt */
  readonly onDismiss: () => void;
}

/**
 * Prompt for logged-in users who have no zones yet
 * Explains what zones are and how to add them
 */
export default function AddInterestsPrompt({
  onAddInterests,
  onDismiss,
}: AddInterestsPromptProps) {
  const handleAddInterests = useCallback(() => {
    trackEvent({
      name: "prompt_add_zones_clicked",
      params: { prompt_type: "first_zone" },
    });
    onAddInterests();
  }, [onAddInterests]);

  const handleDismiss = useCallback(() => {
    trackEvent({
      name: "prompt_add_zones_dismissed",
      params: {},
    });
    onDismiss();
  }, [onDismiss]);

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        className={`fixed inset-0 ${zIndex.modalBackdrop} bg-black/20 backdrop-blur-sm pointer-events-auto`}
        onClick={handleDismiss}
        aria-label="Затвори"
      />
      <div className={`animate-fade-in fixed inset-0 flex items-center justify-center p-4 ${zIndex.modalContent} pointer-events-none`}>
        <div className={`pointer-events-auto w-full max-w-sm bg-white rounded-lg shadow-xl p-4 sm:p-6 sm:pb-4 sm:pr-4`}>
          <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="flex-shrink-0">
              <LocationPinIcon className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">
                Следи избрани зони
              </h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Избери важните за теб места и получавай известия, когато има нещо
                ново там.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.md} font-medium text-xs sm:text-sm`}
            >
              По-късно
            </button>
            <button
              type="button"
              onClick={handleAddInterests}
              className={`${buttonSizes.lg} ${buttonStyles.primary} ${borderRadius.md} shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-1.5 sm:gap-2 font-medium text-xs sm:text-sm`}
            >
              <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              Добави зона
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
