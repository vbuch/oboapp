import { NextResponse } from "next/server";
import { buildV1OpenApi } from "@/lib/v1-api-schema";

export async function GET() {
  return NextResponse.json(buildV1OpenApi());
}
