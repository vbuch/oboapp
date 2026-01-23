"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { SourceConfig } from "@/lib/types";

interface SourceCardProps {
  readonly source: SourceConfig;
}

export default function SourceCard({ source }: SourceCardProps) {
  const [logoError, setLogoError] = useState(false);
  const logoPath = `/sources/${source.id}.png`;

  return (
    <Link
      href={`/sources/${source.id}`}
      className="block bg-white rounded-lg shadow-md p-6 border border-neutral-border hover:shadow-lg transition-shadow"
      onClick={() => {
        trackEvent({
          name: "source_card_clicked",
          params: {
            source_id: source.id,
            source_name: source.name,
            location: "sources_page",
          },
        });
      }}
    >
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          {logoError ? (
            <div className="w-32 h-32 bg-neutral-light rounded-lg flex items-center justify-center">
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
            <Image
              src={logoPath}
              alt={source.name}
              width={128}
              height={128}
              className="w-32 h-32 object-contain rounded-lg"
              onError={() => setLogoError(true)}
            />
          )}
        </div>

        {/* Name */}
        <h3 className="text-lg font-semibold text-foreground">{source.name}</h3>
      </div>
    </Link>
  );
}
