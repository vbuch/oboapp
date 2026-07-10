import type { Metadata } from "next";
import Link from "next/link";
import NotificationsReportClient from "./NotificationsReportClient";
import ReportPageUnavailable from "@/components/ReportPageUnavailable";
import { hasReportPagesEnabled } from "@/lib/report-pages";
import { APP_NAME } from "@/lib/pwa-metadata";

export const metadata: Metadata = {
  title: `Известия | ${APP_NAME}`,
  description: "Справка за доставените известия — брой изпратени, отворени и кликнати.",
};

export default function NotificationsReportPage() {
  if (!hasReportPagesEnabled()) {
    return (
      <ReportPageUnavailable
        title="Известия"
        message="Тази страница е скрита, защото GCS_GENERIC_BUCKET не е конфигуриран за този fork."
        backHref="/sources"
        backLabel="Източници"
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-light flex flex-col">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-6">
          <Link
            href="/"
            className="text-primary hover:text-primary-hover inline-flex items-center gap-2"
          >
            <span>←</span>
            <span>Начало</span>
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-4">Известия</h1>
        <p className="text-sm text-neutral">
          Обобщена справка за всички изпратени известия. Показва колко
          потребители са получили известие, колко са го кликнали и колко са го
          отворили, заедно с разбивка по източник на данни.
        </p>
      </div>

      <NotificationsReportClient />
    </div>
  );
}
