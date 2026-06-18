import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const API_V1_PREFIX = "/api/v1";

function getApiHost(): string | null {
  const raw = process.env.PUBLIC_API_HOST;
  if (!raw) return null;
  const normalized = raw.trim().replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}

export function middleware(request: NextRequest): NextResponse {
  const apiHost = getApiHost();
  if (!apiHost) {
    return NextResponse.json(
      {
        error:
          "PUBLIC_API_HOST is not configured. Configure it to redirect /api/v1/* requests to the dedicated API service.",
      },
      { status: 500 },
    );
  }

  const suffix = request.nextUrl.pathname.slice(API_V1_PREFIX.length);
  const destination = new URL(`/v1${suffix}${request.nextUrl.search}`, apiHost);

  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: ["/api/v1/:path*"],
};
