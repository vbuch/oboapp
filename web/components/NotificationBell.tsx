"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useIsMobile } from "@/lib/hooks/useMediaQuery";
import NotificationDropdown from "./NotificationDropdown";
import UnreadIndicator from "./UnreadIndicator";

// Poll for unread count every 60 seconds
const UNREAD_COUNT_POLL_INTERVAL_MS = 60000;

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
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

    // Listen for unread count changes from other parts of the app
    const handleCountChange = (event: CustomEvent<{ count: number }>) => {
      setUnreadCount(event.detail.count);
    };

    window.addEventListener(
      "notifications:unread-count-changed",
      handleCountChange as EventListener,
    );

    // Poll for updates every 60 seconds
    const interval = setInterval(fetchUnreadCount, UNREAD_COUNT_POLL_INTERVAL_MS);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "notifications:unread-count-changed",
        handleCountChange as EventListener,
      );
    };
  }, [user, fetchUnreadCount]);

  const handleToggle = () => {
    // On mobile (screen width < 640px), navigate to notifications page instead of showing dropdown
    if (isMobile) {
      router.push("/notifications");
    } else {
      setIsOpen(!isOpen);
    }
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
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
      >
        <Bell className="w-6 h-6 text-white" />
        {unreadCount > 0 && <UnreadIndicator />}
      </button>

      {!isMobile && isOpen && (
        <NotificationDropdown
          isOpen={isOpen}
          onClose={handleClose}
          onCountUpdate={handleCountUpdate}
          anchorRef={bellRef}
        />
      )}
    </div>
  );
}
