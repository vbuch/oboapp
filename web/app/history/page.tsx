import type { Metadata } from "next";
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Исторически данни
          </h1>
          <p className="text-sm text-neutral">
            Топлинна карта на всички финализирани съобщения. Показва кои
            квартали се срещат по-често в изходните данни на системата.
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
