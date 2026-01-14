"use client";

import { trackEvent } from "@/lib/analytics";

export default function Footer() {
  return (
    <footer className="bg-footer-bg border-t border-neutral-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="font-bold text-lg mb-4 text-foreground">За проекта</h3>
            <div className="space-y-2 text-sm">
              <div>
                <a
                  href="/kak-se-rodi"
                  className="text-link hover:text-link-hover hover:underline"
                >
                  Как се роди?
                </a>
              </div>
              <div>
                <a href="/sources" className="text-link hover:text-link-hover hover:underline">
                  Източници на данни
                </a>
              </div>
            </div>
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
            , разработен в Оборище с ❤️ за София.
          </p>
        </div>
      </div>
    </footer>
  );
}
