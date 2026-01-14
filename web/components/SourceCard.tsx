"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { SourceConfig } from "@/lib/types";

interface SourceCardProps {
  readonly source: SourceConfig;
}

function extractHostname(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function SourceCard({ source }: SourceCardProps) {
  const [logoError, setLogoError] = useState(false);
  const logoPath = `/sources/${source.id}.png`;

  // Extract display URL (remove protocol and trailing slash)
  const displayUrl = extractHostname(source.url);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          {logoError ? (
            <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-16 h-16 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
          ) : (
            <img
              src={logoPath}
              alt={source.name}
              className="w-32 h-32 object-contain rounded-lg"
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-gray-900">{source.name}</h3>

        {/* URL */}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-hover text-sm font-medium underline break-all"
          onClick={() => {
            trackEvent({
              name: "external_link_clicked",
              params: {
                url: source.url,
                location: "sources_page",
                source_id: source.id,
                source_name: source.name,
              },
            });
          }}
        >
          {displayUrl}
        </a>
      </div>
    </div>
  );
}
