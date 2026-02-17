"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { NotificationHistoryItem } from "@/lib/types";
import Link from "next/link";
import { createMessageUrlFromId } from "@/lib/url-utils";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius, zIndex } from "@/lib/colors";
import SubscribeDevicePrompt from "@/app/settings/SubscribeDevicePrompt";
import {
  subscribeToPushNotifications,
  requestNotificationPermission,
  getNotificationPermission,
} from "@/lib/notification-service";

// Maximum characters to show in notification preview (half of MessageCard length)
const MESSAGE_PREVIEW_MAX_LENGTH = 75;

/**
 * Create text snippet with word boundary truncation.
 * Tries to cut at a word boundary near 75 chars for better readability in dropdown.
 */
function createSnippet(text: string): string {
  const maxLength = MESSAGE_PREVIEW_MAX_LENGTH;
  
  if (text.length <= maxLength) return text;

  // Try to cut at a word boundary near 75 chars
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  // Look for word boundary between 60-75 chars
  if (lastSpace > 60) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

interface NotificationDropdownProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCountUpdate: (count: number) => void;
  readonly anchorRef: React.RefObject<HTMLElement | null>;
}

export default function NotificationDropdown({
  isOpen,
  onClose,
  onCountUpdate,
  anchorRef,
}: NotificationDropdownProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] =
    useState(true);
  const [hasAnySubscriptions, setHasAnySubscriptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async (offset = 0, append = false) => {
    if (!user) return;

    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      const token = await user.getIdToken();
      const url = `/api/notifications/history?limit=20&offset=${offset}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      
      if (append) {
        setNotifications((prev) => [...prev, ...(data.items || [])]);
      } else {
        setNotifications(data.items || []);
      }
      
      setHasMore(data.hasMore || false);
      setNextOffset(data.nextOffset);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Неуспешно зареждане на известията");
      if (!append) {
        setNotifications([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user]);

  const handleLoadMore = useCallback(() => {
    if (nextOffset !== null && !isLoadingMore) {
      fetchNotifications(nextOffset, true);
    }
  }, [nextOffset, isLoadingMore, fetchNotifications]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;

    try {
      // Check if Firebase Messaging is supported
      const { isMessagingSupported } = await import(
        "@/lib/notification-service"
      );
      const supported = await isMessagingSupported();

      if (!supported) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      // Check notification permission
      const permission =
        "Notification" in globalThis ? Notification.permission : "denied";
      
      if (permission !== "granted") {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      // Get current device's FCM token
      const { getMessaging, getToken } = await import("firebase/messaging");
      const { app } = await import("@/lib/firebase");
      const messaging = getMessaging(app);
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
      
      if (!vapidKey) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      const currentToken = await getToken(messaging, { vapidKey });
      
      if (!currentToken) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      // Check if this token is in the backend
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/subscription/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      const subscriptions = await response.json();
      const hasCurrentDevice = Array.isArray(subscriptions) && 
        subscriptions.some((sub) => sub.token === currentToken);
      
      setIsCurrentDeviceSubscribed(hasCurrentDevice);
      setHasAnySubscriptions(Array.isArray(subscriptions) && subscriptions.length > 0);
    } catch (err) {
      console.error("Error checking subscription status:", err);
      // On error, assume not subscribed to show the prompt
      setIsCurrentDeviceSubscribed(false);
      setHasAnySubscriptions(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isOpen) return;

    fetchNotifications();
    checkSubscriptionStatus();
  }, [isOpen, fetchNotifications, checkSubscriptionStatus]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef]);

  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark as read");
      }

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );

      // Update unread count
      const unreadCount = notifications.filter(
        (n) => !n.readAt && n.id !== notificationId,
      ).length;
      onCountUpdate(unreadCount);
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to mark all as read");
      }

      // Update local state
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: now })));

      // Update unread count
      onCountUpdate(0);
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const handleSubscribeCurrentDevice = async () => {
    if (!user) return;

    try {
      // Check if Firebase Messaging is supported first
      const { isMessagingSupported } = await import(
        "@/lib/notification-service"
      );
      const supported = await isMessagingSupported();

      if (!supported) {
        alert(
          "За съжаление, този браузър не поддържа известия.\n\n" +
            "На iOS Safari е необходимо да добавите приложението към началния екран " +
            "преди да можете да получавате известия.",
        );
        return;
      }

      // Check if notifications are blocked
      const currentPermission = getNotificationPermission();
      if (currentPermission === "denied") {
        alert(
          "Известията са блокирани в браузъра. За да ги разрешите:\n\n" +
            "1. Кликнете на иконката на катинара/информацията до адресната лента\n" +
            "2. Намерете настройките за известия\n" +
            "3. Разрешете известията за този сайт\n" +
            "4. Презаредете страницата",
        );
        return;
      }

      const granted = await requestNotificationPermission();
      if (!granted) {
        alert("Моля, разрешете известия в браузъра");
        return;
      }

      const token = await user.getIdToken();
      await subscribeToPushNotifications(user.uid, token);
      setIsCurrentDeviceSubscribed(true);
    } catch (error) {
      console.error("Error subscribing:", error);
      alert("Грешка при абонирането");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white border border-neutral-border rounded-lg shadow-lg ${zIndex.dropdown}`}
      style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-border">
        <h3 className="text-lg font-semibold text-foreground">Известия</h3>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
          >
            Маркирай всички прочетени
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Subscription warning - first item in scrollable container */}
        {!isCurrentDeviceSubscribed && (
          <div className="p-4 border-b border-neutral-border">
            <SubscribeDevicePrompt
              onSubscribe={handleSubscribeCurrentDevice}
              hasAnySubscriptions={hasAnySubscriptions}
            />
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-error">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-neutral">
            Нямате известия
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onClose={onClose}
              />
            ))}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className={`${buttonStyles.secondary} ${buttonSizes.md} ${borderRadius.md} ${isLoadingMore ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {isLoadingMore ? "Зареждане..." : "Зареди още"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  readonly notification: NotificationHistoryItem;
  readonly onMarkAsRead: (id: string) => void;
  readonly onClose: () => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onClose,
}: NotificationItemProps) {
  const isUnread = !notification.readAt;
  const messagePreview = createSnippet(notification.messageSnapshot.text);

  const notifiedDate = new Date(notification.notifiedAt);
  const formattedDate = notifiedDate.toLocaleDateString("bg-BG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    onClose();
  };

  return (
    <Link
      href={createMessageUrlFromId(notification.messageId)}
      onClick={handleClick}
      className={`block p-4 border-b border-neutral-border hover:bg-neutral-light transition-colors ${
        isUnread ? "bg-info-light" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {isUnread && (
          <span className="mt-1 w-2 h-2 bg-primary rounded-full flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-neutral">{formattedDate}</span>
            {notification.distance !== undefined && (
              <span className="text-xs text-neutral">
                {Math.round(notification.distance)}m
              </span>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {messagePreview}
          </p>
        </div>
      </div>
    </Link>
  );
}
