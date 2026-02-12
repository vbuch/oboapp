"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Message } from "@/lib/types";
import { classifyMessage } from "@/lib/message-classification";
import { getCurrentLocalitySources } from "@/lib/source-utils";

const STORAGE_KEY = "sourceFilter";

interface SourceFilterState {
  selectedSources: Set<string>; // Source IDs user has selected (empty = show all)
  hasInteracted: boolean;
}

interface SourceCount {
  sourceId: string;
  name: string;
  count: number;
}

const LOCALE = "bg"; // Bulgarian locale for sorting

export function computeSourceCounts(
  viewportMessages: Message[],
): SourceCount[] {
  const counts = new Map<string, number>();
  
  // Get all sources for the current locality
  const localitySources = getCurrentLocalitySources();

  // Initialize counts for all locality sources (including those with 0 records)
  for (const source of localitySources) {
    counts.set(source.id, 0);
  }

  // Count messages by source
  for (const message of viewportMessages) {
    if (message.source && counts.has(message.source)) {
      const featureCount = message.geoJson?.features?.length || 1;
      counts.set(message.source, counts.get(message.source)! + featureCount);
    }
  }

  // Return ALL sources for the locality, sorted by name (including those with 0 count)
  return localitySources
    .map((source) => ({
      sourceId: source.id,
      name: source.name,
      count: counts.get(source.id) || 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, LOCALE));
}

export function computeHasActiveSourceFilters(
  selectedSources: Set<string>,
): boolean {
  return selectedSources.size > 0;
}

export function toggleSourceSelection(
  current: Set<string>,
  sourceId: string,
): Set<string> {
  const next = new Set(current);
  if (next.has(sourceId)) {
    next.delete(sourceId);
  } else {
    next.add(sourceId);
  }
  return next;
}

function loadFilterState(): SourceFilterState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return {
        selectedSources: new Set(),
        hasInteracted: false,
      };
    }
    const parsed = JSON.parse(stored);

    return {
      selectedSources: new Set(parsed.selectedSources || []),
      hasInteracted: parsed.hasInteracted || false,
    };
  } catch {
    return {
      selectedSources: new Set(),
      hasInteracted: false,
    };
  }
}

function saveFilterState(state: SourceFilterState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        selectedSources: Array.from(state.selectedSources),
        hasInteracted: state.hasInteracted,
        lastUpdated: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Failed to save source filter state:", error);
  }
}

/**
 * Hook for source-based message filtering
 *
 * @param viewportMessages - Messages in current viewport (used for counting)
 * @param showArchived - Whether to include archived messages in counts
 * @param onSourceSelectionChange - Callback when selected sources change
 */
export function useSourceFilter(
  viewportMessages: Message[],
  showArchived: boolean,
  onSourceSelectionChange: (selected: Set<string>) => void,
) {
  const initialFilterState = useMemo(() => loadFilterState(), []);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    () => initialFilterState.selectedSources,
  );
  const [hasInteracted, setHasInteracted] = useState<boolean>(
    () => initialFilterState.hasInteracted,
  );
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);

  // Save to localStorage when state changes
  useEffect(() => {
    saveFilterState({ selectedSources, hasInteracted });
  }, [selectedSources, hasInteracted]);

  // Notify parent when selected sources change
  useEffect(() => {
    onSourceSelectionChange(selectedSources);
  }, [selectedSources, onSourceSelectionChange]);

  // Track loading state when viewportMessages change
  useEffect(() => {
    // Use a flag to prevent state updates if the component unmounts
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    // Defer loading state to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (isMounted) {
        setIsLoadingCounts(true);

        // Keep loading state visible for at least 300ms for better UX
        timerId = setTimeout(() => {
          if (isMounted) {
            setIsLoadingCounts(false);
          }
        }, 300);
      }
    });

    return () => {
      isMounted = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [viewportMessages]);

  // Count features per source - ONLY for viewport messages that match showArchived filter
  const sourceCounts = useMemo<SourceCount[]>(() => {
    let messagesToCount = viewportMessages;

    // Filter messages based on showArchived toggle
    if (!showArchived) {
      // Only count active (non-archived) messages
      messagesToCount = viewportMessages.filter(
        (message) => classifyMessage(message) === "active",
      );
    }

    return computeSourceCounts(messagesToCount);
  }, [viewportMessages, showArchived]);

  // Check if filters are active
  const hasActiveFilters = useMemo<boolean>(() => {
    return computeHasActiveSourceFilters(selectedSources);
  }, [selectedSources]);

  // Toggle a single source's selection state
  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSources((prev) => toggleSourceSelection(prev, sourceId));
    setHasInteracted(true);
  }, []);

  const clearAllSources = useCallback(() => {
    setSelectedSources(new Set());
  }, []);

  return {
    sourceCounts,
    selectedSources,
    hasActiveFilters,
    isLoadingCounts,
    toggleSource,
    clearAllSources,
  };
}
