'use client';

import { useState } from 'react';

export default function Header() {
  const [logoError, setLogoError] = useState(false);

  return (
    <>
      {/* Top Header - Dark Blue */}
      <header className="bg-[#2c3e50] text-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Header with Logo */}
          <div className="flex items-center py-4 relative">
            {/* Logo - overlaps into content area */}
            <div className="relative z-10">
              <div className="w-32 h-40 -mb-8">
                {!logoError ? (
                  <img 
                    src="/logo.png" 
                    alt="СО Оборище" 
                    className="w-full h-full object-contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="w-32 h-40 bg-white rounded-lg flex items-center justify-center shadow-lg border-4 border-yellow-400">
                    <span className="text-[#2c3e50] font-bold text-sm text-center leading-tight">
                      <span className="block">СО</span>
                      <span className="block">Оборище</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="ml-6">
              <h1 className="text-xl font-bold">Район Оборище</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar - Light Blue */}
      <nav className="bg-[#5DADE2]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-6 py-3">
            <a href="/" className="text-white hover:text-gray-200 text-sm font-medium">
              НАЧАЛО
            </a>
          </div>
        </div>
      </nav>
    </>
  );
}
