"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { getCurrentLocalitySources } from "@/lib/source-utils";
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
  generatedAt: string | null;
  trackedSince: string | null;
}

const MODE_LABELS: Record<HeatmapMode, string> = {
  all: "Всички",
  clicked: "Кликнати",
  opened: "Отворени",
};

async function fetchReport(mode: HeatmapMode): Promise<ReportData> {
  const response = await fetch(`/api/notifications/report?mode=${mode}`);
  if (!response.ok) {
    throw new Error("Грешка при зареждане на отчета за известията");
  }
  const data: ReportData = await response.json();
  return data;
}

export default function NotificationsReportClient() {
  const [mode, setMode] = useState<HeatmapMode>("all");
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Track which mode the current data/error belongs to so we can derive loading state
  // without calling setState synchronously inside the effect.
  const [loadedMode, setLoadedMode] = useState<HeatmapMode | null>(null);

  const loading = loadedMode !== mode;

  const sourceNameMap = useMemo(() => {
    try {
      return new Map(getCurrentLocalitySources().map((s) => [s.id, s.name]));
    } catch {
      return new Map<string, string>();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchReport(mode)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
          setLoadedMode(mode);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoadedMode(mode);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-12 space-y-10">
      {/* KPI cards */}
      <ReportKpis data={data} loading={loading} />

      {/* Data freshness note */}
      <div className="text-xs text-neutral space-y-1">
        {data?.trackedSince ? (
          <p>
            Проследяването е активно от{" "}
            {new Date(data.trackedSince).toLocaleDateString("bg-BG")}.
          </p>
        ) : (
          <p>Все още няма записани кликове.</p>
        )}
        {data?.generatedAt && (
          <p>
            Данните са от{" "}
            {new Date(data.generatedAt).toLocaleDateString("bg-BG")}.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-error">
          Грешка при зареждане на данните: {error}
        </p>
      )}

      {/* Source breakdown table */}
      {data && data.sources.length > 0 && (
        <section className="bg-white rounded-lg shadow-md border border-neutral-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Разбивка по източник
          </h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-border">
            <table className="w-full text-sm">
              <thead className="bg-neutral-surface">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground">
                    Източник
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
                    <td className="px-4 py-3 text-foreground">
                      {sourceNameMap.get(row.source) ?? row.source}
                    </td>
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

      {/* Heatmap section — hidden entirely when data is loaded but has no points */}
      {(!data || loading || data.heatmapHiddenForPrivacy || data.heatmapPoints.length > 0) && (
      <section className="bg-white rounded-lg shadow-md border border-neutral-border overflow-hidden">
        <div className="p-6 pb-4 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-xl font-semibold text-foreground">
            Карта на известията
          </h2>
          <div className="flex gap-2">
            {(["all", "clicked"] satisfies HeatmapMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
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
          <div className="px-6 pb-6 pt-2 text-sm text-neutral text-center">
            Картата е скрита — трябват поне 50 записа в избрания режим, за да
            бъде показана.
          </div>
        ) : (
          <div className="h-[450px] border-t border-neutral-border">
            <NotificationsReportMapClient
              mode={mode}
              points={data?.heatmapPoints ?? []}
              loading={loading}
            />
          </div>
        )}
      </section>
      )}
    </div>
  );
}

/**
 * Pure display component for KPI cards. Data fetching lives in the parent.
 */
function ReportKpis({
  data,
  loading,
}: {
  data: ReportData | null;
  loading: boolean;
}) {
  const kpis = data
    ? [
        { label: "Изпратени", value: data.sent },
        { label: "Уникални потребители", value: data.uniqueUsers },
        { label: "Кликнати", value: data.clicked },
      ]
    : null;

  return (
    <div className="grid grid-cols-3 gap-4">
      {kpis
        ? kpis.map(({ label, value }) => (
            <div
              key={label}
              className="bg-white rounded-lg shadow-md border border-neutral-border p-6 text-center"
            >
              <div className="text-2xl font-bold text-primary">
                {value.toLocaleString("bg-BG")}
              </div>
              <div className="text-xs text-neutral mt-1">{label}</div>
            </div>
          ))
        : Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-md border border-neutral-border p-6 h-[88px] animate-pulse"
            />
          ))}
    </div>
  );
}
