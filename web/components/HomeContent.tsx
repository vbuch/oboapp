"use client";

import React, { useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapContainer from "@/components/MapContainer";
import MessageDetailView from "@/components/MessageDetailView";
import MessagesGrid from "@/components/MessagesGrid";
import InterestContextMenu from "@/components/InterestContextMenu";
import CategoryFilterBox from "@/components/CategoryFilterBox";
import GeolocationPrompt from "@/components/GeolocationPrompt";
import { useInterests } from "@/lib/hooks/useInterests";
import { useAuth } from "@/lib/auth-context";
import { useMessages } from "@/lib/hooks/useMessages";
import { useMapNavigation } from "@/lib/hooks/useMapNavigation";
import { useInterestManagement } from "@/lib/hooks/useInterestManagement";
import { useCategoryFilter } from "@/lib/hooks/useCategoryFilter";
import { classifyMessage } from "@/lib/message-classification";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Core hooks
  const {
    interests,
    hasInitialized: interestsLoaded,
    addInterest,
    updateInterest,
    deleteInterest,
  } = useInterests();
  const { user } = useAuth();

  // Message fetching and viewport management
  const {
    messages,
    availableCategories,
    isLoading,
    error,
    handleBoundsChanged,
    setSelectedCategories,
  } = useMessages();

  // Category filtering hook (manages UI state and category selection)
  const categoryFilter = useCategoryFilter(
    availableCategories,
    messages, // Pass all messages initially - we'll filter within the hook
    setSelectedCategories,
  );

  // Filter archived messages based on toggle state
  const filteredMessages = useMemo(() => {
    if (categoryFilter.showArchived) {
      return messages; // Show all messages
    }
    // Filter out archived messages
    return messages.filter((message) => classifyMessage(message) === "active");
  }, [messages, categoryFilter.showArchived]);

  // Map navigation and centering
  const {
    initialMapCenter,
    centerMapFn,
    mapInstance,
    handleMapReady,
    handleAddressClick,
  } = useMapNavigation();

  // Geolocation prompt state (lifted from MapContainer for proper DOM ordering)
  const [geolocationPrompt, setGeolocationPrompt] = React.useState<{
    show: boolean;
    onAccept: () => void;
    onDecline: () => void;
  } | null>(null);

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
    mapInstance,
    addInterest,
    updateInterest,
    deleteInterest,
  );

  // Handle feature click - update URL and select message
  const handleFeatureClick = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        // Update URL with query parameter - this will trigger selectedMessage derivation
        router.push(`/?messageId=${messageId}`, { scroll: false });
      }
    },
    [messages, router],
  );

  // Handle closing detail view
  const handleCloseDetail = useCallback(() => {
    // Remove query parameter from URL - this will trigger selectedMessage derivation
    router.push("/", { scroll: false });
  }, [router]);

  // Derive selected message from URL parameter
  // Note: We search in unfiltered 'messages' to preserve selection even when filtered out
  const selectedMessage = useMemo(() => {
    const messageId = searchParams.get("messageId");
    if (messageId && messages.length > 0) {
      return messages.find((m) => m.id === messageId) || null;
    }
    return null;
  }, [searchParams, messages]);

  return (
    <div
      className="flex-1 flex flex-col [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:flex-row"
      ref={containerRef}
    >
      {/* Error messages */}
      {error && (
        <div className="bg-white border-b shadow-sm z-10 [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:absolute [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:top-0 [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:left-0 [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:right-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="p-4 bg-error-light text-error rounded-md">
              {error}
            </div>
          </div>
        </div>
      )}

      {/* Map Section - Left side on desktop, top on mobile */}
      <div className="relative [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:w-3/5 h-[calc(66vh-64px)] [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:h-[calc(100vh-80px)] [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:sticky [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:top-0 [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:self-start">
        {/* Category Filter Box */}
        <CategoryFilterBox
          isOpen={categoryFilter.isOpen}
          selectedCategories={categoryFilter.selectedCategories}
          categoryCounts={categoryFilter.categoryCounts}
          hasActiveFilters={categoryFilter.hasActiveFilters}
          isInitialLoad={categoryFilter.isInitialLoad}
          isLoadingCounts={categoryFilter.isLoadingCounts}
          showArchived={categoryFilter.showArchived}
          onTogglePanel={categoryFilter.togglePanel}
          onToggleCategory={categoryFilter.toggleCategory}
          onToggleShowArchived={categoryFilter.toggleShowArchived}
          onClearAllCategories={categoryFilter.clearAllCategories}
        />

        <MapContainer
          messages={filteredMessages}
          interests={interests}
          interestsLoaded={interestsLoaded}
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
          onGeolocationPromptChange={setGeolocationPrompt}
        />
        {isLoading && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white px-4 py-2 rounded-lg shadow-md z-20">
            <p className="text-sm text-neutral">Зареждане...</p>
          </div>
        )}
      </div>

      {/* Events Sidebar - Right side on desktop, bottom on mobile */}
      <div className="flex-1 [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:flex-none [@media(min-width:1280px)_and_(min-aspect-ratio:4/3)]:w-2/5 bg-white overflow-y-auto">
        <div className="p-6 @container">
          <MessagesGrid
            messages={filteredMessages}
            isLoading={isLoading}
            onMessageClick={(message) => {
              router.push(`/?messageId=${message.id}`, { scroll: false });
            }}
            variant="list"
          />
        </div>
      </div>

      {/* Message Detail View */}
      <MessageDetailView
        message={selectedMessage}
        onClose={handleCloseDetail}
        onAddressClick={handleAddressClick}
      />

      {/* Interest Context Menu */}
      {interestMenuPosition && selectedInterest && (
        <InterestContextMenu
          position={interestMenuPosition}
          onMove={handleMoveInterest}
          onDelete={handleDeleteInterest}
          onClose={handleCloseInterestMenu}
        />
      )}

      {/* Geolocation Prompt - rendered last for proper z-index stacking */}
      {geolocationPrompt?.show && (
        <GeolocationPrompt
          onAccept={geolocationPrompt.onAccept}
          onDecline={geolocationPrompt.onDecline}
        />
      )}
    </div>
  );
}
