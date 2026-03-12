"use client";

import dynamic from "next/dynamic";
import type { HistoryMapClientProps } from "./HistoryMapClient";

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

export default function HistoryMapWrapper(props: HistoryMapClientProps) {
  return <HistoryMapClient {...props} />;
}
