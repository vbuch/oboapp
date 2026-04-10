"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

interface FooterProps {
  readonly className?: string;
}

const NAV_LINKS = [
  { href: "/kak-se-rodi", label: "Как се роди?" },
  { href: "/sources", label: "Източници на данни" },
  { href: "/ingest-errors", label: "Съобщения с грешки" },
  { href: "/history", label: "Исторически данни" },
  { href: "/unreadable", label: "Нелокализирани съобщения" },
  { href: "/events", label: "Групирани съобщения" },
] as const;

export default function Footer({ className = "" }: FooterProps) {
  return (
    <footer className={`border-t border-neutral-border ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation links — 1 col mobile, 2 col sm, 3 col lg */}
        <div>
          <h3 className="font-bold text-lg mb-4 text-foreground">
            За <span translate="no">OboApp</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2 text-sm">
            {NAV_LINKS.map(({ href, label }) => (
              <div key={href}>
                <Link
                  href={href}
                  className="text-link hover:text-link-hover hover:underline"
                >
                  {label}
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-8 pt-6 border-t border-neutral-border text-center text-sm text-neutral">
          <p>
            <a
              href="https://github.com/vbuch/oboapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:text-link-hover hover:underline"
              onClick={() => {
                trackEvent({
                  name: "external_link_clicked",
                  params: {
                    url: "https://github.com/vbuch/oboapp",
                    location: "footer",
                    link_text: "Отворен код",
                  },
                });
              }}
            >
              Отворен код
            </a>
            с ❤️ за София.
          </p>
        </div>
      </div>
    </footer>
  );
}
