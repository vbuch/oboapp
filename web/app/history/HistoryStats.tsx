"use client";

import { useEffect, useState } from "react";

interface Stats {
  messageCount: number;
  oldestDate: string | null;
}

export default function HistoryStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/messages/heatmap")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.text().catch(() => undefined);
          console.error("Failed to load heatmap stats: HTTP error", {
            status: r.status,
            statusText: r.statusText,
            body,
          });
          throw new Error(
            `Failed to load heatmap stats: ${r.status} ${r.statusText}`,
          );
        }
        return r.json();
      })
      .then((data: unknown) => {
        const d = data as Record<string, unknown>;
        if (typeof d.messageCount === "number") {
          setStats({
            messageCount: d.messageCount,
            oldestDate: typeof d.oldestDate === "string" ? d.oldestDate : null,
          });
        }
      })
      .catch((err: unknown) => {
        console.error("Failed to load heatmap stats:", err);
      });
  }, []);

  if (!stats) return null;

  const oldestFormatted = stats.oldestDate
    ? new Date(stats.oldestDate).toLocaleDateString("bg-BG", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <>
      {" "}
      Картата е базирана на{" "}
      <span className="font-medium">
        {stats.messageCount.toLocaleString("bg-BG")} съобщения
      </span>
      {oldestFormatted && `, най-старото от ${oldestFormatted}`}.
    </>
  );
}
