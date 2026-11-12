"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { zIndex } from "@/lib/colors";
import { APP_NAME } from "@/lib/pwa-metadata";
import UserMenu from "@/components/UserMenu";
import NotificationBell from "@/components/NotificationBell";
import UserSilhouetteIcon from "@/components/icons/UserSilhouetteIcon";

const USER_MENU_ID = "header-user-menu";

export default function Header() {
  const { user } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuTriggerRef = useRef<HTMLButtonElement>(null);

  const handleUserMenuClose = () => {
    setShowUserMenu(false);
    requestAnimationFrame(() => {
      userMenuTriggerRef.current?.focus();
    });
  };

  return (
    <>
      {/* Top Header */}
      <header
        className={`bg-header-bg text-white relative ${zIndex.nav} shadow-md`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between py-2 sm:py-1">
            <Link
              href="/"
              aria-label={`${APP_NAME}, начална страница`}
              className="flex items-center gap-2 sm:gap-4 cursor-pointer hover:opacity-90 transition-opacity"
            >
              {!logoError && (
                <div
                  data-slot="brand-logo"
                  className="relative isolate inline-flex h-9 w-9 shrink-0 items-center justify-center sm:h-10 sm:w-10"
                >
                  <Image
                    data-slot="brand-mark"
                    src="/logo.svg"
                    alt=""
                    width={40}
                    height={40}
                    className="relative h-9 w-9 object-contain sm:h-10 sm:w-10"
                    onError={() => {
                      setLogoError(true);
                    }}
                    priority
                  />
                </div>
              )}
              <h1
                className="text-sm sm:text-base md:text-lg font-bold"
                translate="no"
              >
                {APP_NAME}
              </h1>
            </Link>

            {/* Right side - User Info */}
            <div className="flex items-center gap-4">
              {user && <NotificationBell />}
              <button
                ref={userMenuTriggerRef}
                type="button"
                onClick={() => setShowUserMenu((current) => !current)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-full"
                aria-label="Профилно меню"
                aria-haspopup="dialog"
                aria-expanded={showUserMenu}
                aria-controls={USER_MENU_ID}
              >
                {user?.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt={user.displayName || "Потребител"}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-white">
                    <UserSilhouetteIcon className="w-5 h-5" />
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="bg-nav-bg hidden sm:block">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3 items-center">
            {/* Navigation items can be added here */}
          </div>
        </div>
      </nav>

      {/* User Menu */}
      <UserMenu
        id={USER_MENU_ID}
        isOpen={showUserMenu}
        onClose={handleUserMenuClose}
      />
    </>
  );
}
