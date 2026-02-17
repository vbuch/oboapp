"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { trackEvent } from "@/lib/analytics";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius, zIndex } from "@/lib/colors";
import UserMenu from "@/components/UserMenu";
import NotificationBell from "@/components/NotificationBell";

export default function Header() {
  const { user, signInWithGoogle } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLoginClick = useCallback(async () => {
    trackEvent({ name: "login_initiated", params: { source: "header" } });
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Error signing in from header:", error);
      alert("Неуспешен вход. Моля, опитайте отново.");
    }
  }, [signInWithGoogle]);

  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className={`bg-header-bg text-white relative ${zIndex.nav} shadow-md`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between py-2 sm:py-1">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Logo - overlapping content below */}
              <Link
                href="/"
                className="flex-shrink-0 relative sm:-mb-10 md:-mb-12 cursor-pointer hover:opacity-90 transition-opacity"
              >
                {logoError ? null : (
                  <div className={`inline-block bg-white rounded-lg p-1 shadow-md relative ${zIndex.overlay}`}>
                    <Image
                      src="/logo.png"
                      alt="OboApp"
                      width={96}
                      height={96}
                      className="h-9 sm:h-16 md:h-20 w-auto object-contain"
                      onError={() => setLogoError(true)}
                      priority
                    />
                  </div>
                )}
              </Link>
              <div>
                <h1 className="text-sm sm:text-base md:text-lg font-bold">
                  OboApp
                </h1>
              </div>
            </div>

            {/* Right side - User Info */}
            <div className="flex items-center gap-4">
              {user && <NotificationBell />}
              {user ? (
                <button
                  type="button"
                  onClick={() => setShowUserMenu(true)}
                  className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  aria-label="User menu"
                >
                  {user.photoURL && (
                    <Image
                      src={user.photoURL}
                      alt={user.displayName || "Потребител"}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleLoginClick}
                  className={`${buttonStyles.primary} ${buttonSizes.md} ${borderRadius.sm}`}
                  aria-label="Влез"
                >
                  Влез
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar - Light Blue */}
      <nav className="bg-nav-bg hidden sm:block">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3 items-center">
            {/* Navigation items can be added here */}
          </div>
        </div>
      </nav>

      {/* User Menu */}
      <UserMenu isOpen={showUserMenu} onClose={() => setShowUserMenu(false)} />
    </>
  );
}
