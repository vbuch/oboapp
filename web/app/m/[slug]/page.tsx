"use client";

import { useParams, useRouter, notFound } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Message } from "@/lib/types";
import MessageDetailView from "@/components/MessageDetailView";

export default function MessagePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [message, setMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/messages/by-slug?slug=${encodeURIComponent(slug)}`,
        );

        if (response.status === 404) {
          notFound();
          return;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch message");
        }

        const data = await response.json();
        setMessage(data.message);
      } catch (err) {
        console.error("Error fetching message:", err);
        setError("Неуспешно зареждане на съобщението");
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchMessage();
    }
  }, [slug]);

  const handleClose = useCallback(() => {
    router.push("/");
  }, [router]);

  const handleAddressClick = useCallback(
    (lat: number, lng: number) => {
      router.push(`/?lat=${lat}&lng=${lng}`);
    },
    [router],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-error text-lg mb-4">{error}</p>
          <button
            type="button"
            onClick={handleClose}
            className="text-primary hover:text-primary-hover"
          >
            Към началната страница
          </button>
        </div>
      </div>
    );
  }

  return (
    <MessageDetailView
      message={message}
      onClose={handleClose}
      onAddressClick={handleAddressClick}
    />
  );
}
