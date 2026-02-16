"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { trackEvent } from "@/lib/analytics";
import { zIndex } from "@/lib/colors";

interface UserMenuProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export default function UserMenu({ isOpen, onClose }: UserMenuProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = () => {
    trackEvent({ name: "logout_clicked", params: { zones_count: 0 } });
    signOut();
    onClose();
  };

  if (!user) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <button
          type="button"
          className={`fixed inset-0 ${zIndex.overlay} bg-black/20 backdrop-blur-sm pointer-events-auto`}
          onClick={onClose}
          aria-label="Close menu"
        />
      )}

      {/* Slide-in Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-[300px] ${zIndex.overlayContent} bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral hover:text-neutral transition-colors"
          aria-label="Close menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* User Info Section */}
        <div className="px-6 py-4 border-b border-neutral-border">
          <div className="flex items-center gap-3 mb-2">
            {user.photoURL && (
              <Image
                src={user.photoURL}
                alt={user.displayName || "Потребител"}
                width={40}
                height={40}
                className="w-12 h-12 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user.displayName || user.email}
              </p>
              {user.displayName && user.email && (
                <p className="text-xs text-neutral truncate">{user.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-2">
          {/* Settings Link */}
          <Link
            href="/settings"
            onClick={onClose}
            className="block w-full px-6 py-3 text-left text-sm hover:bg-neutral-light transition-colors"
          >
            Настройки
          </Link>

          {/* Divider */}
          <hr className="my-2 border-neutral-border" />

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full px-6 py-3 text-left text-sm text-error hover:bg-error-light transition-colors"
          >
            Излез
          </button>
        </div>
      </div>
    </>
  );
}
