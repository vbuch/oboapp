"use client";

import { LoadScript } from "@react-google-maps/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { AuthProvider } from "@/lib/auth-context";
import SplashScreen from "@/components/SplashScreen";
import QueryProvider from "@/components/QueryProvider";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  return (
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
              <Footer />
            </div>
            <CookieConsent />
          </AuthProvider>
        </QueryProvider>
      </LoadScript>
    </div>
  );
}
