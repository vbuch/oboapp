import { redirect } from "next/navigation";

/**
 * Redirect /m/{id} to /?messageId={id} so the message detail opens
 * as an overlay on the homepage map instead of a standalone page.
 *
 * This route exists to support shareable/external URLs (push notifications,
 * social sharing, bookmarks). The homepage handles message selection
 * natively via the `messageId` query parameter.
 * 
 * This is a server component that redirects immediately without requiring
 * client-side JavaScript or hydration.
 */
export default async function MessageRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/?messageId=${encodeURIComponent(slug)}`);
}
