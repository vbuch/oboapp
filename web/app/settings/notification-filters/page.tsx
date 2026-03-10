"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useNotificationFilters } from "@/lib/hooks/useNotificationFilters";
import { getCurrentLocalitySources } from "@/lib/source-utils";
import CategoryFilterItem from "@/components/CategoryFilterItem";
import SourceFilterItem from "@/components/SourceFilterItem";
import {
  CATEGORY_DISPLAY_ORDER,
  CATEGORY_LABELS,
  UNCATEGORIZED,
  UNCATEGORIZED_LABEL,
} from "@oboapp/shared";
import { buttonStyles, buttonSizes } from "@/lib/theme";
import { borderRadius } from "@/lib/colors";
import { ArrowLeft, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

export default function NotificationFiltersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const {
    selectedCategories,
    selectedSources,
    isLoading,
    isSaving,
    error,
    isDirty,
    toggleCategory,
    toggleSource,
    selectAllCategories,
    deselectAllCategories,
    selectAllSources,
    deselectAllSources,
    save,
    clearAll,
    resetToSaved,
  } = useNotificationFilters();

  const sources = useMemo(() => {
    try {
      return getCurrentLocalitySources();
    } catch {
      return [];
    }
  }, []);

  /** All category values including "uncategorized" */
  const allCategoryValues = useMemo(
    () => [...CATEGORY_DISPLAY_ORDER, UNCATEGORIZED],
    [],
  );

  const allSourceIds = useMemo(() => sources.map((s) => s.id), [sources]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
    }
  }, [authLoading, user, router]);

  const handleSave = async () => {
    try {
      await save();
      router.push("/settings");
    } catch {
      // Error is shown via the hook's error state
    }
  };

  const handleCancel = () => {
    resetToSaved();
    router.push("/settings");
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/settings"
          className="text-neutral hover:text-foreground transition-colors"
          aria-label="Обратно към настройки"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">
          Филтри за известия
        </h1>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-info-light border border-info-border rounded-lg">
        <Info size={20} className="text-info flex-shrink-0 mt-0.5" />
        <p className="text-sm text-info">
          Промените ще се приложат само за бъдещи известия. Вече получените
          известия няма да бъдат засегнати.
        </p>
      </div>

      {error && (
        <div className="p-4 mb-6 bg-error-light border border-error-border rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Categories Section */}
          <section className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Категории
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectAllCategories(allCategoryValues)}
                  className="text-xs text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
                >
                  Избери всички
                </button>
                <span className="text-neutral-border">|</span>
                <button
                  type="button"
                  onClick={deselectAllCategories}
                  className="text-xs text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
                >
                  Изчисти всички
                </button>
              </div>
            </div>
            <p className="text-sm text-neutral mb-4">
              Изберете категориите, за които искате да получавате известия. Ако
              не изберете нищо, ще получавате известия от всички категории.
            </p>
            <div className="space-y-1">
              {CATEGORY_DISPLAY_ORDER.map((category) => (
                <CategoryFilterItem
                  key={category}
                  category={category}
                  label={CATEGORY_LABELS[category]}
                  checked={selectedCategories.has(category)}
                  onChange={() => toggleCategory(category)}
                />
              ))}
              <CategoryFilterItem
                category={UNCATEGORIZED}
                label={UNCATEGORIZED_LABEL}
                checked={selectedCategories.has(UNCATEGORIZED)}
                onChange={() => toggleCategory(UNCATEGORIZED)}
              />
            </div>
          </section>

          {/* Sources Section */}
          <section className="bg-white rounded-lg shadow mb-6 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Източници
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => selectAllSources(allSourceIds)}
                  className="text-xs text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
                >
                  Избери всички
                </button>
                <span className="text-neutral-border">|</span>
                <button
                  type="button"
                  onClick={deselectAllSources}
                  className="text-xs text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
                >
                  Изчисти всички
                </button>
              </div>
            </div>
            <p className="text-sm text-neutral mb-4">
              Изберете източниците, от които искате да получавате известия. Ако
              не изберете нищо, ще получавате известия от всички източници.
            </p>
            <div className="space-y-1">
              {sources.map((source) => (
                <SourceFilterItem
                  key={source.id}
                  label={source.name}
                  checked={selectedSources.has(source.id)}
                  onChange={() => toggleSource(source.id)}
                  count={0}
                  isLoadingCount={false}
                />
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className={`${buttonStyles.primary} ${buttonSizes.md} ${borderRadius.sm}`}
            >
              {isSaving ? "Запазване..." : "Запази"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className={`${buttonStyles.ghost} ${buttonSizes.md} ${borderRadius.sm}`}
            >
              Отказ
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={
                isSaving ||
                (selectedCategories.size === 0 && selectedSources.size === 0)
              }
              className={`${buttonStyles.secondary} ${buttonSizes.md} ${borderRadius.sm} ml-auto`}
            >
              Изчисти всички филтри
            </button>
          </div>
        </>
      )}
    </div>
  );
}
