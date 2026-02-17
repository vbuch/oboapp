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
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] =
    useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/history", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();
      setNotifications(Array.isArray(data) ? data : []);
      setHasMore(false); // TODO: Implement pagination
    } catch (err) {
      console.error("Error fetching notifications:", err);
      setError("Неуспешно зареждане на известията");
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/subscription/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch subscriptions");
      }

      const subscriptions = await response.json();
      setIsCurrentDeviceSubscribed(
        Array.isArray(subscriptions) && subscriptions.length > 0,
      );
    } catch (err) {
      console.error("Error checking subscription status:", err);
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
      className={`absolute top-full right-0 mt-2 w-screen max-w-96 bg-white border border-neutral-border rounded-lg shadow-lg ${zIndex.dropdown}`}
      style={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-border">
        <h3 className="text-lg font-semibold text-foreground">Известия</h3>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm text-primary hover:text-primary-hover"
          >
            Маркирай всички прочетени
          </button>
        )}
      </div>

      {/* Subscription warning */}
      {!isCurrentDeviceSubscribed && (
        <div className="p-4 border-b border-neutral-border">
          <SubscribeDevicePrompt
            onSubscribe={handleSubscribeCurrentDevice}
            hasAnySubscriptions={false}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
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
                  className={`${buttonStyles.secondary} ${buttonSizes.md} ${borderRadius.md}`}
                >
                  Зареди още
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
  const messagePreview =
    notification.messageSnapshot.text.length > 100
      ? notification.messageSnapshot.text.substring(0, 100) + "..."
      : notification.messageSnapshot.text;

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
          <p className="text-sm text-foreground line-clamp-3">
            {messagePreview}
          </p>
        </div>
      </div>
    </Link>
  );
}
