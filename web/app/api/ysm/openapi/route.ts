import { NextResponse } from "next/server";
import { buildYsmOpenApi } from "@/lib/ysm-api-schema";

export async function GET() {
  return NextResponse.json(buildYsmOpenApi());
}
