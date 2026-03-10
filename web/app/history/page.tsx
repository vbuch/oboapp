import type { Metadata } from "next";
import Link from "next/link";
import HistoryMapWrapper from "./HistoryMapWrapper";

export const metadata: Metadata = {
  title: "Исторически данни | OboApp",
  description:
    "Топлинна карта на исторически данни от всички събрани съобщения",
};

export default function HistoryPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-neutral-border px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto space-y-1">
          <div className="mb-2">
            <Link
              href="/"
              className="text-primary hover:text-primary-hover inline-flex items-center gap-2 text-sm"
            >
              <span>←</span>
              <span>Начало</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Исторически данни
          </h1>
          <p className="text-sm text-neutral">
            Топлинна карта на всички финализирани съобщения. Показва кои
            квартали се срещат по-често в данните на системата.
            Може да бъде показател за това къде е нужно да извлечем повече данни
            или за това къде районните администрации могат да
            споделят повече информация.
          </p>
        </div>
      </div>

      {/* Full-height map */}
      <div className="flex-1">
        <HistoryMapWrapper />
      </div>
    </div>
  );
}
