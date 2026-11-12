"use client";

import { useState } from "react";
import Image from "next/image";
import { APP_NAME } from "@/lib/pwa-metadata";

export default function SplashScreen() {
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {!logoError && (
          <div className="motion-safe:animate-pulse">
            <Image
              src="/logo.svg"
              alt={APP_NAME}
              width={120}
              height={120}
              onError={() => {
                setLogoError(true);
              }}
              priority
            />
          </div>
        )}
        <p className="text-foreground text-lg">Зареждане...</p>
      </div>
    </div>
  );
}
