"use client";

import { useCallback, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapContainer from "@/components/MapContainer";
import MessageDetailView from "@/components/MessageDetailView";
import MessagesGrid from "@/components/MessagesGrid";
import InterestContextMenu from "@/components/InterestContextMenu";
import CategoryFilterBox from "@/components/CategoryFilterBox";
import { useInterests } from "@/lib/hooks/useInterests";
import { useAuth } from "@/lib/auth-context";
import { useMessages } from "@/lib/hooks/useMessages";
import { useMapNavigation } from "@/lib/hooks/useMapNavigation";
import { useInterestManagement } from "@/lib/hooks/useInterestManagement";
import { useCategoryFilter } from "@/lib/hooks/useCategoryFilter";

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
    categoriesError,
    handleBoundsChanged,
    setSelectedCategories,
  } = useMessages();

  // Category filtering
  // - availableCategories: From /api/categories (all categories that exist)
  // - messages: Viewport messages (used for counting per category)
  const categoryFilter = useCategoryFilter(
    availableCategories,
    messages,
    setSelectedCategories,
  );

  // Map navigation and centering
  const {
    initialMapCenter,
    centerMapFn,
    mapInstance,
    handleMapReady,
    handleAddressClick,
  } = useMapNavigation();

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
    <div className="flex-1 flex flex-col overflow-y-auto" ref={containerRef}>
      {/* Error messages */}
      {(error || categoriesError) && (
        <div className="bg-white border-b shadow-sm z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {error && (
              <div className="p-4 bg-error-light text-error rounded-md mb-2">
                {error}
              </div>
            )}
            {categoriesError && (
              <div className="p-4 bg-warning-light text-warning rounded-md">
                {categoriesError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Filter Box */}
      <CategoryFilterBox
        isOpen={categoryFilter.isOpen}
        selectedCategories={categoryFilter.selectedCategories}
        categoryCounts={categoryFilter.categoryCounts}
        hasActiveFilters={categoryFilter.hasActiveFilters}
        isInitialLoad={categoryFilter.isInitialLoad}
        isLoadingCounts={categoryFilter.isLoadingCounts}
        onTogglePanel={categoryFilter.togglePanel}
        onToggleCategory={categoryFilter.toggleCategory}
      />

      {/* Map - Takes viewport height to allow scrolling */}
      <div
        className="relative"
        style={{ height: "calc(100vh - 120px)", minHeight: "500px" }}
      >
        <MapContainer
          messages={messages}
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
          position={interestMenuPosition}
          onMove={handleMoveInterest}
          onDelete={handleDeleteInterest}
          onClose={handleCloseInterestMenu}
        />
      )}
    </div>
  );
}
