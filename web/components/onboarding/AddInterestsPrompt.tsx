"use client";

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { borderRadius } from "@/lib/colors";
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
    <div className="animate-fade-in absolute bottom-4 right-4 z-40 bg-white rounded-lg shadow-xl p-6 pb-4 pr-4 max-w-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0">
          <LocationPinIcon className="w-10 h-10 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-900 mb-2">
            Следи избрани зони
          </h3>
          <p className="text-sm text-gray-600">
            Избери важните за теб места и получавай известия, когато има нещо
            ново там.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.md} font-medium`}
        >
          По-късно
        </button>
        <button
          type="button"
          onClick={handleAddInterests}
          className={`${buttonSizes.lg} ${buttonStyles.primary} ${borderRadius.md} shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 font-medium`}
        >
          <PlusIcon className="w-5 h-5" />
          Добави зона
        </button>
      </div>
    </div>
  );
}
