"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Message } from "@/lib/types";
import {
  Category,
  CATEGORY_DISPLAY_ORDER,
  UNCATEGORIZED,
} from "@oboapp/shared";
import { classifyMessage } from "@/lib/message-classification";

const STORAGE_KEY = "categoryFilter";

interface CategoryFilterState {
  unselectedCategories: Set<Category | typeof UNCATEGORIZED>; // Categories user has unselected
  hasInteracted: boolean;
  showArchived: boolean; // Whether to show archived (past) items
}

interface CategoryCount {
  category: Category | typeof UNCATEGORIZED; // Display both real categories and uncategorized
  count: number;
}

export function computeSelectedCategories(
  availableCategories: Set<Category | typeof UNCATEGORIZED>,
  unselectedCategories: Set<Category | typeof UNCATEGORIZED>,
): Set<Category | typeof UNCATEGORIZED> {
  const selected = new Set<Category | typeof UNCATEGORIZED>();
  for (const category of availableCategories) {
    if (!unselectedCategories.has(category)) {
      selected.add(category);
    }
  }
  return selected;
}

export function computeCategoryCounts(
  availableCategories: Set<Category | typeof UNCATEGORIZED>,
  viewportMessages: Message[],
): CategoryCount[] {
  const counts = new Map<Category | typeof UNCATEGORIZED, number>();

  for (const category of availableCategories) {
    counts.set(category, 0);
  }

  for (const message of viewportMessages) {
    const featureCount = message.geoJson?.features?.length || 1;

    if (
      !message.categories ||
      !Array.isArray(message.categories) ||
      message.categories.length === 0
    ) {
      if (counts.has(UNCATEGORIZED)) {
        counts.set(UNCATEGORIZED, counts.get(UNCATEGORIZED)! + featureCount);
      }
    } else {
      for (const category of message.categories) {
        if (counts.has(category as Category)) {
          counts.set(
            category as Category,
            counts.get(category as Category)! + featureCount,
          );
        }
      }
    }
  }

  const orderedCounts: CategoryCount[] = CATEGORY_DISPLAY_ORDER.filter((cat) =>
    availableCategories.has(cat),
  ).map((category) => ({
    category,
    count: counts.get(category) || 0,
  }));

  if (availableCategories.has(UNCATEGORIZED)) {
    orderedCounts.push({
      category: UNCATEGORIZED,
      count: counts.get(UNCATEGORIZED) || 0,
    });
  }

  return orderedCounts;
}

export function computeHasActiveFilters(
  selectedCategories: Set<Category | typeof UNCATEGORIZED>,
  availableCategories: Set<Category | typeof UNCATEGORIZED>,
): boolean {
  return selectedCategories.size !== availableCategories.size;
}

export function toggleCategorySelection(
  current: Set<Category | typeof UNCATEGORIZED>,
  category: Category | typeof UNCATEGORIZED,
): Set<Category | typeof UNCATEGORIZED> {
  const next = new Set(current);
  if (next.has(category)) {
    next.delete(category);
  } else {
    next.add(category);
  }
  return next;
}

function loadFilterState(): CategoryFilterState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // Default: nothing unselected (all selected), archived (past items) hidden by default
      return {
        unselectedCategories: new Set(),
        hasInteracted: false,
        showArchived: false,
      };
    }
    const parsed = JSON.parse(stored);
    return {
      unselectedCategories: new Set(parsed.unselectedCategories || []),
      hasInteracted: parsed.hasInteracted || false,
      showArchived: parsed.showArchived ?? false, // Default to false if not set
    };
  } catch {
    return {
      unselectedCategories: new Set(),
      hasInteracted: false,
      showArchived: false,
    };
  }
}

function saveFilterState(state: CategoryFilterState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        unselectedCategories: Array.from(state.unselectedCategories),
        hasInteracted: state.hasInteracted,
        showArchived: state.showArchived,
        lastUpdated: new Date().toISOString(),
      }),
    );
  } catch (error) {
    console.error("Failed to save category filter state:", error);
  }
}

/**
 * Hook for category-based message filtering
 *
 * @param availableCategories - Categories that exist in the database (from /api/categories)
 * @param viewportMessages - Messages in current viewport (used for counting)
 * @param onCategorySelectionChange - Callback when selected categories change
 */
export function useCategoryFilter(
  availableCategories: (Category | typeof UNCATEGORIZED)[],
  viewportMessages: Message[],
  onCategorySelectionChange: (
    selected: Set<Category | typeof UNCATEGORIZED>,
  ) => void,
) {
  const initialFilterState = useMemo(() => loadFilterState(), []);
  // Store which categories the user has UNSELECTED (not which are selected)
  const [unselectedCategories, setUnselectedCategories] = useState<
    Set<Category | typeof UNCATEGORIZED>
  >(() => initialFilterState.unselectedCategories);
  const [hasInteracted, setHasInteracted] = useState<boolean>(
    () => initialFilterState.hasInteracted,
  );
  const [showArchived, setShowArchived] = useState<boolean>(
    () => initialFilterState.showArchived,
  );
  const [isOpen, setIsOpen] = useState<boolean>(
    () => !initialFilterState.hasInteracted,
  );
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [isLoadingCounts, setIsLoadingCounts] = useState<boolean>(false);

  // Save to localStorage when state changes
  useEffect(() => {
    saveFilterState({ unselectedCategories, hasInteracted, showArchived });
  }, [unselectedCategories, hasInteracted, showArchived]);

  // Convert availableCategories array to Set
  const availableCategoriesSet = useMemo<
    Set<Category | typeof UNCATEGORIZED>
  >(() => {
    return new Set(availableCategories);
  }, [availableCategories]);

  // Compute selected categories: all available categories MINUS unselected ones
  const selectedCategories = useMemo<
    Set<Category | typeof UNCATEGORIZED>
  >(() => {
    return computeSelectedCategories(
      availableCategoriesSet,
      unselectedCategories,
    );
  }, [availableCategoriesSet, unselectedCategories]);

  // Notify parent when selected categories change
  useEffect(() => {
    onCategorySelectionChange(selectedCategories);
  }, [selectedCategories, onCategorySelectionChange]);

  // Track loading state when viewportMessages or availableCategories change
  useEffect(() => {
    // Skip initial load - it's handled by isInitialLoad state
    if (isInitialLoad) {
      return;
    }

    // Use a flag to prevent state updates if the component unmounts
    let isMounted = true;

    // Defer loading state to avoid synchronous setState in effect
    Promise.resolve().then(() => {
      if (isMounted) {
        setIsLoadingCounts(true);

        // Keep loading state visible for at least 300ms for better UX
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
  }, [viewportMessages, availableCategoriesSet, isInitialLoad]);

  // Handle initial load separately
  useEffect(() => {
    if (isInitialLoad && viewportMessages.length > 0) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isInitialLoad, viewportMessages]);

  // Count features per category - ONLY for viewport messages that match showArchived filter
  const categoryCounts = useMemo<CategoryCount[]>(() => {
    let messagesToCount = viewportMessages;

    // Filter messages based on showArchived toggle
    if (!showArchived) {
      // Only count active (non-archived) messages
      messagesToCount = viewportMessages.filter(
        (message) => classifyMessage(message) === "active",
      );
    }

    return computeCategoryCounts(availableCategoriesSet, messagesToCount);
  }, [availableCategoriesSet, viewportMessages, showArchived]);

  // Check if filters are active (something is unselected)
  // Red dot shows when ANY category is unchecked (not in default "all selected" state)
  const hasActiveFilters = useMemo<boolean>(() => {
    return computeHasActiveFilters(selectedCategories, availableCategoriesSet);
  }, [selectedCategories, availableCategoriesSet]);

  // Toggle a single category's selection state
  // IMPORTANT: Only modifies the toggled category in localStorage, preserving all others
  // Example flow:
  // 1. User sees [traffic, heating], unselects heating → stores ["heating"]
  // 2. User sees [heating, water], unselects water → stores ["heating", "water"]
  // 3. User sees [traffic, water] → traffic is selected (not in storage), water unselected (in storage)
  // 4. User sees [traffic, heating, water] → heating & water unselected (in storage), traffic selected
  const toggleCategory = useCallback(
    (category: Category | typeof UNCATEGORIZED) => {
      setUnselectedCategories((prev) =>
        toggleCategorySelection(prev, category),
      );
    },
    [],
  );

  const openPanel = useCallback(() => {
    setIsOpen(true);
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    if (!hasInteracted) {
      setHasInteracted(true);
    }
  }, [hasInteracted]);

  const togglePanel = useCallback(() => {
    if (isOpen) {
      closePanel();
    } else {
      openPanel();
    }
  }, [isOpen, openPanel, closePanel]);

  const toggleShowArchived = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

  return {
    categoryCounts,
    selectedCategories,
    hasActiveFilters,
    isOpen,
    isInitialLoad,
    isLoadingCounts,
    showArchived,
    toggleCategory,
    toggleShowArchived,
    openPanel,
    closePanel,
    togglePanel,
  };
}
