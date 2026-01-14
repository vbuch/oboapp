import React from "react";
import type { Pin, StreetSection } from "@/lib/types";
import DetailItem from "./DetailItem";

interface LocationsProps {
  pins?: Pin[] | null;
  streets?: StreetSection[] | null;
}

export default function Locations({ pins, streets }: LocationsProps) {
  return (
    <>
      {pins && pins.length > 0 && (
        <DetailItem title="Локации">
          <div className="space-y-3">
            {pins.map((pin, index) => (
              <div
                key={`pin-${pin.address}-${index}`}
                className="bg-neutral-light rounded-md p-3 border border-neutral-border"
              >
                <p className="text-sm font-medium text-foreground mb-1">
                  {pin.address}
                </p>
                {pin.timespans && pin.timespans.length > 0 && (
                  <div className="text-xs text-neutral space-y-1">
                    {pin.timespans.map((timespan, tIndex) => (
                      <div
                        key={`timespan-${timespan.start}-${timespan.end}-${tIndex}`}
                      >
                        {timespan.start} - {timespan.end}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DetailItem>
      )}

      {streets && streets.length > 0 && (
        <DetailItem title="Улични участъци">
          <div className="space-y-3">
            {streets.map((street, index) => (
              <div
                key={`street-${street.street}-${street.from}-${street.to}-${index}`}
                className="bg-neutral-light rounded-md p-3 border border-neutral-border"
              >
                <p className="text-sm font-medium text-foreground mb-1">
                  {street.street}
                </p>
                <p className="text-xs text-neutral mb-1">
                  От: {street.from} → До: {street.to}
                </p>
                {street.timespans && street.timespans.length > 0 && (
                  <div className="text-xs text-neutral space-y-1">
                    {street.timespans.map((timespan, tIndex) => (
                      <div
                        key={`street-timespan-${timespan.start}-${timespan.end}-${tIndex}`}
                      >
                        {timespan.start} - {timespan.end}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </DetailItem>
      )}
    </>
  );
}
