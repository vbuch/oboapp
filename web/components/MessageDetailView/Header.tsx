import React from "react";
import { trackEvent } from "@/lib/analytics";

interface HeaderProps {
  handlers: Record<string, any>;
  onClose: () => void;
  messageId?: string;
}

export default function Header({
  handlers,
  onClose,
  messageId = "unknown",
}: HeaderProps) {
  const handleClose = () => {
    trackEvent({
      name: "message_detail_closed",
      params: {
        message_id: messageId,
        close_method: "button",
      },
    });
    onClose();
  };

  return (
    <div className="sticky top-0 bg-white border-b border-neutral-border px-4 sm:px-6 py-4 flex items-center justify-between shadow-sm z-10">
      <button
        type="button"
        className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-neutral-border rounded-full sm:hidden cursor-grab active:cursor-grabbing"
        {...handlers}
        onClick={handleClose}
        aria-label="Плъзни, за да затвориш, или натисни, за да затвориш"
      />

      <h2 className="text-lg sm:text-xl font-semibold text-foreground pt-3 sm:pt-0">
        Детайли за сигнала
      </h2>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-neutral-light rounded-full mt-3 sm:mt-0"
        aria-label="Затвори детайлите"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  );
}
