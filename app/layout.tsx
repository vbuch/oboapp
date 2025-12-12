import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oborishte Map - Report Issues in Sofia",
  description: "Report and track issues in Oborishte District, Sofia, Bulgaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
