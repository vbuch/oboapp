import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Исторически данни | OboApp",
  description:
    "Топлинна карта на исторически данни от всички събрани съобщения",
};

const HistoryMapClient = dynamic(() => import("./HistoryMapClient"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-neutral-light">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-neutral">Зареждане на картата...</p>
      </div>
    </div>
  ),
});

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
        <HistoryMapClient />
      </div>
    </div>
  );
}
