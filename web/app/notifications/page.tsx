"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NotificationHistoryItem } from "@/lib/types";
import Link from "next/link";
import { createMessageUrlFromId } from "@/lib/url-utils";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";
import SubscribeDevicePrompt from "@/app/settings/SubscribeDevicePrompt";
import {
  subscribeToPushNotifications,
  requestNotificationPermission,
  getNotificationPermission,
} from "@/lib/notification-service";

// Use same snippet logic as dropdown
const MESSAGE_PREVIEW_MAX_LENGTH = 75;

function createSnippet(text: string): string {
  const maxLength = MESSAGE_PREVIEW_MAX_LENGTH;
  
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 60) {
    return truncated.substring(0, lastSpace) + "...";
  }

  return truncated + "...";
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationHistoryItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [isCurrentDeviceSubscribed, setIsCurrentDeviceSubscribed] =
    useState(true);

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
      const { isMessagingSupported } = await import(
        "@/lib/notification-service"
      );
      const supported = await isMessagingSupported();

      if (!supported) {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

      const permission =
        "Notification" in globalThis ? Notification.permission : "denied";
      
      if (permission !== "granted") {
        setIsCurrentDeviceSubscribed(false);
        return;
      }

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
    } catch (err) {
      console.error("Error checking subscription status:", err);
      setIsCurrentDeviceSubscribed(false);
    }
  }, [user]);

  const handleSubscribeCurrentDevice = async () => {
    if (!user) return;

    try {
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

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n,
        ),
      );
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

      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: now })));
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    fetchNotifications();
    checkSubscriptionStatus();
  }, [user, router, fetchNotifications, checkSubscriptionStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Известия</h1>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Известия</h1>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-sm text-primary hover:text-primary-hover cursor-pointer transition-colors"
            >
              Маркирай всички прочетени
            </button>
          )}
        </div>

        {error && (
          <div className="bg-error-light border border-error-border rounded-lg p-4 mb-6">
            <p className="text-error">{error}</p>
          </div>
        )}

        {/* Subscription warning - first item */}
        {!isCurrentDeviceSubscribed && (
          <div className="mb-6">
            <SubscribeDevicePrompt
              onSubscribe={handleSubscribeCurrentDevice}
              hasAnySubscriptions={false}
            />
          </div>
        )}

        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-neutral text-lg">Нямате известия</p>
          </div>
        ) : (
          <div className="space-y-0">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
            {hasMore && (
              <div className="p-4 text-center bg-white border-t border-neutral-border">
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
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationItemProps {
  readonly notification: NotificationHistoryItem;
  readonly onMarkAsRead: (id: string) => void;
}

function NotificationItem({
  notification,
  onMarkAsRead,
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
  };

  return (
    <Link
      href={createMessageUrlFromId(notification.messageId)}
      onClick={handleClick}
      className={`block p-4 border-b border-neutral-border hover:bg-neutral-light transition-colors bg-white ${
        isUnread ? "!bg-info-light" : ""
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
