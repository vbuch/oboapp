"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import UserMenu from "@/components/UserMenu";

export default function Header() {
  const { user } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className="bg-header-bg text-white relative z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center justify-between py-3">
            {/* Left side - Logo and Title */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Logo - overlapping content below */}
              <Link
                href="/"
                className="flex-shrink-0 relative -mb-8 sm:-mb-16 md:-mb-20 cursor-pointer hover:opacity-90 transition-opacity"
              >
                {logoError ? null : (
                  <Image
                    src="/logo.png"
                    alt="OboApp"
                    width={128}
                    height={128}
                    className="h-16 sm:h-24 md:h-32 w-auto object-contain relative z-30"
                    onError={() => setLogoError(true)}
                    priority
                  />
                )}
              </Link>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-bold">
                  OboApp
                </h1>
              </div>
            </div>

            {/* Right side - User Info */}
            <div>
              {user && (
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
