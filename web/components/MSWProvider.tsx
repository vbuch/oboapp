"use client";

import { useEffect, useState } from "react";

/**
 * MSW Provider - Conditionally initializes Mock Service Worker
 * Only runs when NEXT_PUBLIC_USE_MSW=true
 */
export function MSWProvider({ children }: { children: React.ReactNode }) {
  const isMSWEnabled =
    process.env.NEXT_PUBLIC_USE_MSW === "true" &&
    process.env.NODE_ENV === "development";

  const [mswReady, setMswReady] = useState(() => !isMSWEnabled);

  useEffect(() => {
    const initMSW = async () => {
      if (isMSWEnabled) {
        try {
          const { worker } = await import("@/__mocks__/browser");
          await worker.start({
            onUnhandledRequest: "bypass",
            quiet: false,
          });
          console.log("[MSW] Mock Service Worker started");
          setMswReady(true);
        } catch (error) {
          console.error("[MSW] Failed to start Mock Service Worker:", error);
          // Fall back to rendering children without MSW
          setMswReady(true);
        }
      }
    };

    initMSW();
  }, [isMSWEnabled]);

  // Don't render children until MSW is ready (prevents race conditions)
  if (!mswReady) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
        }}
      >
        <p>Loading mock service worker...</p>
      </div>
    );
  }

  return <>{children}</>;
}
