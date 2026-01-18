import Link from "next/link";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

interface SubscribePromptProps {
  readonly onClose: () => void;
}

/**
 * Shown when user has zones but no push notification subscriptions
 * Guides them to Settings to enable notifications
 */
export default function SubscribePrompt({ onClose }: SubscribePromptProps) {
  return (
    <div className="animate-fade-in absolute bottom-4 right-4 z-40 max-w-sm">
      <div className="bg-warning-light border-2 border-warning-border rounded-lg shadow-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">⚠️</div>
          <div className="flex-1">
            <h3 className="font-semibold text-warning mb-2">
              Няма абонамент за известия
            </h3>
            <p className="text-warning text-sm mb-3">
              Имате зони на интерес, но не сте абонирани за известия. Това е
              основната задача на OboApp!
            </p>
            <div className="flex gap-2">
              <Link
                href="/settings"
                className={`${buttonSizes.md} font-medium ${buttonStyles.primary} ${borderRadius.md}`}
              >
                Отиди в настройки
              </Link>
              <button
                type="button"
                onClick={onClose}
                className={`${buttonSizes.md} font-medium ${buttonStyles.warning} ${borderRadius.md}`}
              >
                По-късно
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
