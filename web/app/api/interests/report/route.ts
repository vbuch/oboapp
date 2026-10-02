import { NextResponse } from "next/server";
import { hasReportPagesEnabled } from "@/lib/report-pages";
import { loadCurrentInterestReport } from "@/lib/interest-coverage-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

/** Public GCS snapshot endpoint. Privacy revision checks must never be cached. */
export async function GET() {
  if (!hasReportPagesEnabled()) {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
  try {
    const report = await loadCurrentInterestReport();
    if (!report) return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
    // Revision identifiers are internal freshness controls, not public metadata.
    const { sourceRevision: _revision, ...publicReport } = report;
    return NextResponse.json(publicReport, { headers });
  } catch (error) {
    console.error("Failed to load interest coverage report", error);
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers });
  }
}
