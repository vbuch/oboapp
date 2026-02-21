"use client";

import { LoadScript } from "@react-google-maps/api";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { AuthProvider } from "@/lib/auth-context";
import SplashScreen from "@/components/SplashScreen";
import QueryProvider from "@/components/QueryProvider";
import { MSWProvider } from "@/components/MSWProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const pathname = usePathname();
  const isClient = typeof window !== "undefined";

  const hideFooterOnMobile =
    pathname === "/" &&
    isClient &&
    new URLSearchParams(window.location.search).has("messageId");

  return (
    <MSWProvider>
      <div className="antialiased flex flex-col h-screen overflow-hidden">
        <LoadScript
          googleMapsApiKey={mapsApiKey}
          loadingElement={<SplashScreen />}
          preventGoogleFontsLoading
        >
          <QueryProvider>
            <AuthProvider>
              <Header />
              <div className="flex-1 flex flex-col overflow-y-auto">
                <main className="flex-1 flex flex-col">{children}</main>
                <Footer
                  className={hideFooterOnMobile ? "hidden sm:block" : undefined}
                />
              </div>
              <CookieConsent />
            </AuthProvider>
          </QueryProvider>
        </LoadScript>
      </div>
    </MSWProvider>
  );
}
