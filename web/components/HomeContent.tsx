"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapContainer from "@/components/MapContainer";
import MessageDetailView from "@/components/MessageDetailView";
import NotificationPrompt from "@/components/NotificationPrompt";
import LoginPrompt from "@/components/LoginPrompt";
import SubscribePrompt from "@/components/SubscribePrompt";
import MessagesGrid from "@/components/MessagesGrid";
import InterestContextMenu from "@/components/InterestContextMenu";
import { Message } from "@/lib/types";
import { useInterests } from "@/lib/hooks/useInterests";
import { useNotificationPrompt } from "@/lib/hooks/useNotificationPrompt";
import { useAuth } from "@/lib/auth-context";
import { useMessages } from "@/lib/hooks/useMessages";
import { useMapNavigation } from "@/lib/hooks/useMapNavigation";
import { useInterestManagement } from "@/lib/hooks/useInterestManagement";

/**
 * HomeContent - Main application component managing map, messages, and user interactions
 *
 * Loading and Initialization Flow:
 * 1. Component mounts with isLoading=false, map renders immediately
 * 2. Map loads and triggers onBoundsChanged when ready
 * 3. handleBoundsChanged sets viewportBounds after 300ms debounce
 * 4. Effect detects viewportBounds change and calls fetchMessages(viewportBounds)
 * 5. fetchMessages sets isLoading=true, shows loading indicator
 * 6. When fetch completes, isLoading=false, loading indicator disappears
 *
 * This ensures the map is visible immediately while messages load based on viewport.
 */
export default function HomeContent() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const [hasCheckedSubscriptions, setHasCheckedSubscriptions] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core hooks
  const { interests, addInterest, updateInterest, deleteInterest } =
    useInterests();
  const { user } = useAuth();
  const { showPrompt, onAccept, onDecline, checkAndPromptForNotifications } =
    useNotificationPrompt();

  // Message fetching and viewport management
  const { messages, isLoading, error, handleBoundsChanged } = useMessages();

  // Map navigation and centering
  const { initialMapCenter, centerMapFn, handleMapReady, handleAddressClick } =
    useMapNavigation();

  // Interest/zone management
  const {
    targetMode,
    selectedInterest,
    interestMenuPosition,
    handleInterestClick,
    handleMoveInterest,
    handleDeleteInterest,
    handleStartAddInterest,
    handleSaveInterest,
    handleCancelTargetMode,
    handleCloseInterestMenu,
  } = useInterestManagement(
    centerMapFn,
    addInterest,
    updateInterest,
    deleteInterest
  );

  // Check for notification permission when user has circles
  useEffect(() => {
    if (user && interests.length > 0) {
      user
        .getIdToken()
        .then((idToken) => {
          checkAndPromptForNotifications(user.uid, idToken, true);
        })
        .catch((err) => {
          console.error("Failed to check notification permissions:", err);
        });
    }
  }, [user, interests.length, checkAndPromptForNotifications]);

  // Check if user has zones but no subscriptions
  useEffect(() => {
    if (
      !user ||
      interests.length === 0 ||
      hasCheckedSubscriptions ||
      showPrompt
    ) {
      return;
    }

    const checkSubscriptions = async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/notifications/subscription/all", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const subscriptions = await response.json();
          if (Array.isArray(subscriptions) && subscriptions.length === 0) {
            // User has zones but no subscriptions - show prompt
            setShowSubscribePrompt(true);
          }
        }
      } catch (error) {
        console.error("Error checking subscriptions:", error);
      } finally {
        setHasCheckedSubscriptions(true);
      }
    };

    checkSubscriptions();
  }, [user, interests.length, hasCheckedSubscriptions, showPrompt]);

  // Handle feature click - update URL and select message
  const handleFeatureClick = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setSelectedMessage(message);
        // Update URL with query parameter
        router.push(`/?messageId=${messageId}`, { scroll: false });
      }
    },
    [messages, router]
  );

  // Handle closing detail view
  const handleCloseDetail = useCallback(() => {
    setSelectedMessage(null);
    // Remove query parameter from URL
    router.push("/", { scroll: false });
  }, [router]);

  // Sync selected message with URL parameter
  useEffect(() => {
    const messageId = searchParams.get("messageId");
    if (messageId && messages.length > 0) {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        setSelectedMessage(message);
      } else {
        // Message not found, clear the parameter
        setSelectedMessage(null);
      }
    } else if (!messageId && selectedMessage) {
      // URL was changed (e.g., back button) without messageId
      setSelectedMessage(null);
    }
  }, [searchParams, messages, selectedMessage]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto" ref={containerRef}>
      {/* Error message if any */}
      {error && (
        <div className="bg-white border-b shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="p-4 bg-error-light text-error rounded-md">
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Map - Takes viewport height to allow scrolling */}
      <div
        className="relative"
        style={{ height: "calc(100vh - 120px)", minHeight: "500px" }}
      >
        <MapContainer
          messages={messages}
          interests={interests}
          user={user}
          targetMode={targetMode}
          initialMapCenter={initialMapCenter}
          onFeatureClick={handleFeatureClick}
          onMapReady={handleMapReady}
          onBoundsChanged={handleBoundsChanged}
          onInterestClick={handleInterestClick}
          onSaveInterest={handleSaveInterest}
          onCancelTargetMode={handleCancelTargetMode}
          onStartAddInterest={handleStartAddInterest}
        />
        {isLoading && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-md z-20">
            <p className="text-sm text-neutral">Зареждане...</p>
          </div>
        )}
      </div>

      {/* Messages Grid - Below the map */}
      <MessagesGrid
        messages={messages}
        isLoading={isLoading}
        onMessageClick={(message) => {
          setSelectedMessage(message);
          router.push(`/?messageId=${message.id}`, { scroll: false });
        }}
      />

      {/* Message Detail View */}
      <MessageDetailView
        message={selectedMessage}
        onClose={handleCloseDetail}
        onAddressClick={handleAddressClick}
      />

      {/* Interest Context Menu */}
      {interestMenuPosition && selectedInterest && (
        <InterestContextMenu
          interest={selectedInterest}
          position={interestMenuPosition}
          onMove={handleMoveInterest}
          onDelete={handleDeleteInterest}
          onClose={handleCloseInterestMenu}
        />
      )}

      {/* Notification permission prompt */}
      {showPrompt && (
        <NotificationPrompt
          onAccept={onAccept}
          onDecline={onDecline}
          zonesCount={interests.length}
        />
      )}

      {/* Subscribe prompt - shown when user has zones but no subscriptions */}
      {showSubscribePrompt && (
        <SubscribePrompt onClose={() => setShowSubscribePrompt(false)} />
      )}

      {/* Login prompt for non-authenticated users */}
      {!user && <LoginPrompt />}
    </div>
  );
}
