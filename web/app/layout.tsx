import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

export const metadata: Metadata = {
  title: "Карта Оборище",
  description: "Следи събитията в район Оборище",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://oborishte-map.vercel.app"
  ),
  openGraph: {
    title: "Карта Оборище",
    description: "Следи събитията в район Оборище",
    images: ["/icon-512x512.png"],
    locale: "bg_BG",
    type: "website",
    siteName: "Карта Оборище",
  },
  twitter: {
    card: "summary",
    title: "Карта Оборище",
    description: "Следи събитията в район Оборище",
    images: ["/icon-512x512.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bg">
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
