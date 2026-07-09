"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { HeatmapMode } from "../api/notifications/report/aggregation";

const NotificationsReportMapClient = dynamic(
  () => import("./NotificationsReportMapClient"),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-neutral-light">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-neutral">Зареждане на картата...</p>
        </div>
      </div>
    ),
  },
);

interface SourceRow {
  source: string;
  sent: number;
  clicked: number;
}

interface ReportData {
  sent: number;
  uniqueUsers: number;
  clicked: number;
  opened: number;
  heatmapPoints: [number, number][];
  heatmapHiddenForPrivacy: boolean;
  sources: SourceRow[];
}

const MODE_LABELS: Record<HeatmapMode, string> = {
  all: "Всички",
  clicked: "Кликнати",
  opened: "Отворени",
};

async function fetchReport(mode: HeatmapMode): Promise<ReportData> {
  const response = await fetch(`/api/notifications/report?mode=${mode}`);
  if (!response.ok) {
    throw new Error("Failed to fetch notifications report");
  }
  const data: ReportData = await response.json();
  return data;
}

export default function NotificationsReportClient() {
  const [mode, setMode] = useState<HeatmapMode>("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data when mode changes — triggered by the map component via a stable callback.
  // We lift the fetch here so KPIs and map share the same data fetch.
  const [mapMode, setMapMode] = useState<HeatmapMode>("all");

  function handleModeChange(newMode: HeatmapMode) {
    setMode(newMode);
    setMapMode(newMode);
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 space-y-10">
      {/* KPI cards */}
      <ReportKpis
        mode={mode}
        onModeChange={handleModeChange}
        onDataLoaded={(d) => { setData(d); setLoading(false); setError(null); }}
        onError={(e) => { setError(e); setLoading(false); }}
        loading={loading}
      />

      {error && (
        <p className="text-sm text-error">
          Грешка при зареждане на данните: {error}
        </p>
      )}

      {/* Source breakdown table */}
      {data && data.sources.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Разбивка по извор
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-border">
            <table className="w-full text-sm">
              <thead className="bg-neutral-surface">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">
                    Извор
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">
                    Изпратени
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground">
                    Кликнати
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((row) => (
                  <tr
                    key={row.source}
                    className="border-t border-neutral-border"
                  >
                    <td className="px-4 py-3 text-foreground">{row.source}</td>
                    <td className="px-4 py-3 text-right text-neutral">
                      {row.sent.toLocaleString("bg-BG")}
                    </td>
                    <td className="px-4 py-3 text-right text-neutral">
                      {row.clicked.toLocaleString("bg-BG")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Heatmap section */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            Карта на известията
          </h2>
          <div className="flex gap-2">
            {(["all", "clicked", "opened"] satisfies HeatmapMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-primary text-white"
                    : "bg-neutral-surface text-foreground border border-neutral-border hover:bg-neutral-border",
                ].join(" ")}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {data?.heatmapHiddenForPrivacy ? (
          <div className="rounded-lg border border-neutral-border bg-neutral-surface p-6 text-sm text-neutral text-center">
            Картата е скрита — трябват поне 50 записа в избрания режим, за да
            бъде показана.
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border border-neutral-border h-[450px]">
            <NotificationsReportMapClient
              mode={mapMode}
              points={data?.heatmapPoints ?? []}
              loading={loading}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Loads report data and renders KPI cards.
 * Separated so it can trigger the initial fetch and notify the parent.
 */
function ReportKpis({
  mode,
  onModeChange,
  onDataLoaded,
  onError,
  loading,
}: {
  mode: HeatmapMode;
  onModeChange: (mode: HeatmapMode) => void;
  onDataLoaded: (data: ReportData) => void;
  onError: (error: string) => void;
  loading: boolean;
}) {
  const [data, setData] = useState<ReportData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [lastMode, setLastMode] = useState<HeatmapMode | null>(null);

  if (mode !== lastMode && !fetching) {
    setFetching(true);
    setLastMode(mode);
    fetchReport(mode)
      .then((d) => {
        setData(d);
        onDataLoaded(d);
      })
      .catch((e: unknown) => {
        onError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setFetching(false));
  }

  const kpis = data
    ? [
        { label: "Изпратени", value: data.sent },
        { label: "Уникални потребители", value: data.uniqueUsers },
        { label: "Кликнати", value: data.clicked },
        { label: "Отворени", value: data.opened },
      ]
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {kpis
        ? kpis.map(({ label, value }) => (
            <div
              key={label}
              className="bg-neutral-surface rounded-lg border border-neutral-border p-4 text-center"
            >
              <div className="text-2xl font-bold text-primary">
                {value.toLocaleString("bg-BG")}
              </div>
              <div className="text-xs text-neutral mt-1">{label}</div>
            </div>
          ))
        : Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-neutral-surface rounded-lg border border-neutral-border p-4 h-20 animate-pulse"
            />
          ))}
    </div>
  );
}
