"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NotificationHistoryItem } from "@/lib/types";
import Link from "next/link";
import Card from "@/components/Card";

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [historyItems, setHistoryItems] = useState<NotificationHistoryItem[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      setError(null);

      const token = await user.getIdToken();
      const response = await fetch("/api/notifications/history", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notification history");
      }

      const data = await response.json();
      setHistoryItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching notification history:", err);
      setError("Неуспешно зареждане на историята на известията");
      setHistoryItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    fetchHistory();
  }, [user, router, fetchHistory]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-6">
            <Link
              href="/settings"
              className="text-primary hover:text-primary-hover flex items-center gap-2"
            >
              <span>←</span>
              <span>Обратно към настройките</span>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            История на известията
          </h1>
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
        <div className="mb-6">
          <Link
            href="/settings"
            className="text-primary hover:text-primary-hover flex items-center gap-2"
          >
            <span>←</span>
            <span>Обратно към настройките</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          История на известията
        </h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {historyItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 text-lg">
              Все още нямате получени известия
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {historyItems.map((item) => (
              <NotificationHistoryCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface NotificationHistoryCardProps {
  readonly item: NotificationHistoryItem;
}

function NotificationHistoryCard({ item }: NotificationHistoryCardProps) {
  const messagePreview =
    item.messageSnapshot.text.length > 200
      ? item.messageSnapshot.text.substring(0, 200) + "..."
      : item.messageSnapshot.text;

  const notifiedDate = new Date(item.notifiedAt);
  const formattedDate = notifiedDate.toLocaleDateString("bg-BG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`/?messageId=${item.messageId}`} className="block">
      <Card clickable>
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <p className="text-sm text-gray-500 mb-1">{formattedDate}</p>
            {item.messageSnapshot.source && (
              <p className="text-xs text-gray-400 mb-2">
                Източник: {item.messageSnapshot.source}
              </p>
            )}
          </div>
          {item.distance && (
            <span className="text-sm text-gray-500 ml-4">
              {Math.round(item.distance)}m
            </span>
          )}
        </div>

        <p className="text-gray-900 mb-3 whitespace-pre-wrap">
          {messagePreview}
        </p>

        <div className="flex items-center gap-4 text-sm text-gray-500">
          {item.successfulDevicesCount > 0 && (
            <span>
              Изпратено на {item.successfulDevicesCount}{" "}
              {item.successfulDevicesCount === 1
                ? "ваш абонамент"
                : "ваши абонамента"}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
