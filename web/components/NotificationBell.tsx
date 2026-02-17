"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import NotificationDropdown from "./NotificationDropdown";

export default function NotificationBell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/unread-count", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch unread count");
      }

      const data = await response.json();
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();

    // Poll for updates every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [user, fetchUnreadCount]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleCountUpdate = (newCount: number) => {
    setUnreadCount(newCount);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={handleToggle}
        className="relative flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-header-bg" />
        )}
      </button>

      <NotificationDropdown
        isOpen={isOpen}
        onClose={handleClose}
        onCountUpdate={handleCountUpdate}
        anchorRef={bellRef}
      />
    </div>
  );
}
