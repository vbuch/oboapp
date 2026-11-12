import { describe, expect, it } from "vitest";
import { peachColors } from "@/lib/colors";

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("peach palette contrast", () => {
  it.each([
    peachColors.accent,
    peachColors.hover,
    peachColors.pressed,
    peachColors.secondary,
    peachColors["secondary-hover"],
    peachColors["secondary-pressed"],
    peachColors["filter-hover"],
  ])("keeps action text readable on %s", (paper) => {
    expect(contrast(peachColors.ink, paper)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["warning", "info", "success", "error"] as const)(
    "keeps %s notice text readable on its paper",
    (role) => {
      expect(
        contrast(peachColors[`${role}-ink`], peachColors[`${role}-paper`]),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(["info", "success", "error"] as const)(
    "keeps white text readable on filled %s actions",
    (role) => {
      expect(contrast(peachColors.panel, peachColors[`${role}-ink`]))
        .toBeGreaterThanOrEqual(4.5);
      expect(contrast(peachColors.panel, peachColors[`${role}-hover`]))
        .toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    "water", "electricity", "heating", "construction", "transport", "parking",
    "waste", "air", "culture", "neutral",
  ] as const)("keeps %s category text and hover marks readable", (category) => {
    const ink = peachColors[`category-${category}-ink`];
    const paper = peachColors[`category-${category}-paper`];

    expect(contrast(ink, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, peachColors["filter-hover"]))
      .toBeGreaterThanOrEqual(3);
  });

  it.each([
    peachColors.panel,
    peachColors.background,
    peachColors.selected,
  ])("keeps action text and focus outlines visible on %s", (paper) => {
    expect(contrast(peachColors.action, paper)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    peachColors.secondary,
    peachColors["secondary-hover"],
    peachColors["secondary-pressed"],
  ])("keeps secondary action boundaries visible on %s", (paper) => {
    expect(contrast(peachColors["secondary-border"], paper))
      .toBeGreaterThanOrEqual(3);
  });
});
