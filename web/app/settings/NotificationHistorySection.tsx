"use client";

import Link from "next/link";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";

interface NotificationHistorySectionProps {
  readonly count: number;
}

export default function NotificationHistorySection({
  count,
}: NotificationHistorySectionProps) {
  if (count === 0) {
    return null;
  }

  return (
    <section className="bg-white rounded-lg shadow mb-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            История на известията
          </h2>
          <p className="text-gray-600">
            Получили сте общо {count} {count === 1 ? "известие" : "известия"}
          </p>
        </div>
        <Link
          href="/notifications"
          className={`${buttonSizes.md} ${buttonStyles.primary} ${borderRadius.md}`}
        >
          Вижте история
        </Link>
      </div>
    </section>
  );
}
