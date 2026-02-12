"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Message } from "@/lib/types";
import sources from "@/lib/sources.json";

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

export function computeSourceCounts(
  viewportMessages: Message[],
): SourceCount[] {
  const counts = new Map<string, number>();

  // Initialize counts for all known sources
  for (const source of sources) {
    counts.set(source.id, 0);
  }

  // Count messages by source
  for (const message of viewportMessages) {
    if (message.source && counts.has(message.source)) {
      const featureCount = message.geoJson?.features?.length || 1;
      counts.set(message.source, counts.get(message.source)! + featureCount);
    }
  }

  // Return only sources with non-zero counts, sorted by name
  return sources
    .map((source) => ({
      sourceId: source.id,
      name: source.name,
      count: counts.get(source.id) || 0,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));
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
 * @param onSourceSelectionChange - Callback when selected sources change
 */
export function useSourceFilter(
  viewportMessages: Message[],
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
    let isMounted = true;

    Promise.resolve().then(() => {
      if (isMounted) {
        setIsLoadingCounts(true);

        const timer = setTimeout(() => {
          if (isMounted) {
            setIsLoadingCounts(false);
          }
        }, 300);

        return () => clearTimeout(timer);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [viewportMessages]);

  // Count features per source
  const sourceCounts = useMemo<SourceCount[]>(() => {
    return computeSourceCounts(viewportMessages);
  }, [viewportMessages]);

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
