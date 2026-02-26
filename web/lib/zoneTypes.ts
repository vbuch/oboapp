import { colors } from "@/lib/colors";

export const ZONE_LABEL_HINTS = [
  "Вкъщи",
  "Работа",
  "Родители",
  "Училище",
] as const;

export interface ZoneColorOption {
  readonly id: string;
  readonly label: string;
  readonly color: string;
}

export const ZONE_COLOR_OPTIONS: readonly ZoneColorOption[] = [
  { id: "blue", label: "Синьо", color: colors.zones.blue },
  { id: "green", label: "Зелено", color: colors.zones.green },
  { id: "yellow", label: "Жълто", color: colors.zones.yellow },
  { id: "red", label: "Червено", color: colors.zones.red },
  { id: "purple", label: "Лилаво", color: colors.zones.purple },
  { id: "orange", label: "Оранжево", color: colors.zones.orange },
] as const;

export const DEFAULT_ZONE_COLOR = ZONE_COLOR_OPTIONS[0].color;
export const MAX_ZONE_LABEL_LENGTH = 40;

const ZONE_COLOR_SET = new Set(
  ZONE_COLOR_OPTIONS.map((option) => option.color),
);

export function sanitizeZoneLabel(label: unknown): string | undefined {
  if (typeof label !== "string") {
    return undefined;
  }

  const normalized = label.replaceAll(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.slice(0, MAX_ZONE_LABEL_LENGTH);
}

export function sanitizeZoneColor(color: unknown): string | undefined {
  if (typeof color !== "string") {
    return undefined;
  }

  return ZONE_COLOR_SET.has(color) ? color : undefined;
}
