"use client";

import { useEffect, useState } from "react";
import { hasConsentDecision, setConsent, initGA } from "@/lib/analytics";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

export default function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't made a decision yet
    setIsVisible(!hasConsentDecision());
  }, []);

  const handleAccept = () => {
    setConsent(true);
    setIsVisible(false);
    initGA();
  };

  const handleDecline = () => {
    setConsent(false);
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 p-4 w-full max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Бисквитки и поверителност
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Използваме бисквитки за анализ на трафика и подобряване на
              потребителското изживяване. Данните се обработват от Google
              Analytics. Можете да приемете или откажете използването на
              бисквитки.
            </p>
            <p className="text-xs text-gray-500">
              Забележка: Сайтът използва също Google Maps и Firebase, които
              могат да използват собствени бисквитки извън нашия контрол.
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleDecline}
              className={`${buttonSizes.md} font-medium ${buttonStyles.secondary} ${borderRadius.md}`}
            >
              Откажи
            </button>
            <button
              onClick={handleAccept}
              className={`${buttonSizes.md} font-medium ${buttonStyles.primary} ${borderRadius.md}`}
            >
              Приеми
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
