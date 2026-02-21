/**
 * Predefined zone types for user interest zones.
 * Each type has a fixed label and colour used throughout the map and UI.
 */
export interface ZoneType {
  id: string;
  label: string;
  color: string;
}

export const ZONE_TYPES: readonly ZoneType[] = [
  { id: "home", label: "Дома", color: "#3B82F6" },
  { id: "office", label: "Офис", color: "#8B5CF6" },
  { id: "parents", label: "Родители", color: "#10B981" },
  { id: "school", label: "Училище", color: "#F59E0B" },
  { id: "gym", label: "Фитнес", color: "#F97316" },
  { id: "other", label: "Друго", color: "#6B7280" },
] as const;
