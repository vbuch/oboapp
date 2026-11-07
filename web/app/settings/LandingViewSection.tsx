"use client";

import { useState } from "react";
import {
  useLandingPreference,
  type LandingView,
} from "@/lib/hooks/useLandingPreference";

const OPTIONS: readonly { value: LandingView; label: string }[] = [
  { value: "events", label: "Събития" },
  { value: "zones", label: "Моите зони" },
];

export function LandingViewSection() {
  const { preferredLandingView, isLoading, setPreferredLandingView } =
    useLandingPreference();
  const [saveFailed, setSaveFailed] = useState(false);

  const handleChange = (view: LandingView) => {
    setSaveFailed(!setPreferredLandingView(view));
  };

  return (
    <section className="bg-white rounded-lg shadow mb-6 p-6">
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Начален изглед
      </h2>
      <p id="landing-view-description" className="text-neutral mb-4">
        Избери какво да виждаш при отваряне на приложението на това устройство.
      </p>
      <fieldset
        disabled={isLoading}
        aria-describedby="landing-view-description"
        className="space-y-3"
      >
        <legend className="sr-only">Избор на начален изглед</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-3 text-foreground cursor-pointer"
          >
            <input
              type="radio"
              name="landing-view"
              value={option.value}
              checked={(preferredLandingView ?? "events") === option.value}
              onChange={() => {
                handleChange(option.value);
              }}
              className="accent-primary"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {saveFailed && (
        <p role="alert" className="text-error text-sm mt-3">
          Настройката не се запази. Провери дали браузърът позволява запазване на
          данни и опитай отново.
        </p>
      )}
    </section>
  );
}
