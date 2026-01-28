import { NextResponse } from "next/server";
import sources from "@/lib/sources.json";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  const response = (
    sources as Array<{ id: string; name: string; url: string }>
  ).map((source) => ({
    ...source,
    logoUrl: `${baseUrl}/sources/${source.id}.png`,
  }));

  return NextResponse.json({ sources: response });
}
