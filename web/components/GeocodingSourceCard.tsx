"use client";

import { trackEvent } from "@/lib/analytics";
import { SourceConfig } from "@/lib/types";
import { extractHostname } from "@/lib/url-utils";

interface GeocodingSourceCardProps {
  readonly source: SourceConfig;
}

export default function GeocodingSourceCard({
  source,
}: GeocodingSourceCardProps) {
  // Extract display URL (remove protocol and trailing slash)
  const displayUrl = extractHostname(source.url);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-neutral-border hover:shadow-lg transition-shadow">
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Name */}
        <h3 className="text-lg font-semibold text-foreground">{source.name}</h3>

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
