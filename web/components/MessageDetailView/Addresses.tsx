import React from "react";
import { trackEvent } from "@/lib/analytics";
import type { Address } from "@/lib/types";
import DetailItem from "./DetailItem";

interface AddressesProps {
  addresses?: Address[] | null;
  onAddressClick?: (lat: number, lng: number) => void;
  onClose: () => void;
  messageId?: string;
}

export default function Addresses({
  addresses,
  onAddressClick,
  onClose,
  messageId = "unknown",
}: AddressesProps) {
  if (!addresses || addresses.length === 0) return null;

  return (
    <DetailItem title="Адреси">
      <div className="space-y-2">
        {addresses.map((address, index) => (
          <button
            type="button"
            key={`address-${address.formattedAddress}-${index}`}
            onClick={() => {
              trackEvent({
                name: "address_clicked",
                params: {
                  message_id: messageId,
                  formatted_address: address.formattedAddress,
                },
              });
              onAddressClick?.(
                address.coordinates.lat,
                address.coordinates.lng,
              );
              onClose();
            }}
            className="w-full text-left bg-neutral-light rounded-md p-3 border border-neutral-border hover:bg-info-light hover:border-info-border transition-colors cursor-pointer"
          >
            <p className="text-sm text-foreground">
              {address.formattedAddress}
            </p>
            {address.coordinates && (
              <p className="text-xs text-neutral mt-1">
                {address.coordinates.lat.toFixed(6)},{" "}
                {address.coordinates.lng.toFixed(6)}
              </p>
            )}
          </button>
        ))}
      </div>
    </DetailItem>
  );
}
