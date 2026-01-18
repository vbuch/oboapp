"use client";

import { useState } from "react";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

interface DeleteAccountSectionProps {
  readonly onDeleteAccount: (confirmText: string) => Promise<void>;
  readonly isDeleting: boolean;
}

export default function DeleteAccountSection({
  onDeleteAccount,
  isDeleting,
}: DeleteAccountSectionProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = async () => {
    await onDeleteAccount(confirmText);
    // Reset state after attempt
    setShowConfirm(false);
    setConfirmText("");
  };

  return (
    <section className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Изтриване на профил
      </h2>

      <p className="text-neutral mb-4">
        Това действие ще изтрие всички ваши данни, включително зони на интерес,
        абонаменти за известия и история на известия.
      </p>

      {showConfirm ? (
        <div className="border border-error-border rounded-lg p-4 bg-error-light relative z-30">
          <p className="text-error font-semibold mb-3">
            Сигурни ли сте, че искате да изтриете профила си?
          </p>
          <p className="text-error text-sm mb-4">
            Това действие е необратимо. Напишете <strong>ИЗТРИЙ</strong> за
            потвърждение:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ИЗТРИЙ"
            className={`w-full px-3 py-2 border border-error-border ${borderRadius.md} mb-4 focus:outline-none focus:ring-2 focus:ring-error`}
          />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting || confirmText !== "ИЗТРИЙ"}
              className={`${buttonSizes.md} ${buttonStyles.destructive} ${borderRadius.md}`}
            >
              {isDeleting ? "Изтриване..." : "Потвърди изтриването"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setConfirmText("");
              }}
              disabled={isDeleting}
              className={`${buttonSizes.md} ${buttonStyles.secondary} ${borderRadius.md}`}
            >
              Отказ
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className={`${buttonSizes.md} ${buttonStyles.destructive} ${borderRadius.md}`}
        >
          Изтрий профила ми
        </button>
      )}
    </section>
  );
}
