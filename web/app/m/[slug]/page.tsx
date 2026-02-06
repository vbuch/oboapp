"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirect /m/{slug} to /?slug={slug} so the message detail opens
 * as an overlay on the homepage map instead of a standalone page.
 *
 * This route exists to support shareable/external URLs (push notifications,
 * social sharing, bookmarks). The homepage handles slug-based message
 * selection natively via the `slug` query parameter.
 */
export default function MessageRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  useEffect(() => {
    router.replace(`/?slug=${encodeURIComponent(slug)}`);
  }, [slug, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}
