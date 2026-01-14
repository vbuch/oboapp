"use client";

import { trackEvent } from "@/lib/analytics";
import { SourceConfig } from "@/lib/types";

interface GeocodingSourceCardProps {
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

export default function GeocodingSourceCard({
  source,
}: GeocodingSourceCardProps) {
  // Extract display URL (remove protocol and trailing slash)
  const displayUrl = extractHostname(source.url);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center text-center space-y-4">
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
                location: "sources_page_geocoding",
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
