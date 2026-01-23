"use client";

import { LoadScript } from "@react-google-maps/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieConsent from "@/components/CookieConsent";
import { AuthProvider } from "@/lib/auth-context";
import SplashScreen from "@/components/SplashScreen";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="antialiased flex flex-col h-screen overflow-hidden">
      <LoadScript
        googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        loadingElement={<SplashScreen />}
      >
        <AuthProvider>
          <Header />
          <div className="flex-1 flex flex-col overflow-y-auto">
            <main className="flex-1 flex flex-col">{children}</main>
            <Footer />
          </div>
          <CookieConsent />
        </AuthProvider>
      </LoadScript>
    </div>
  );
}
