import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ZoneBadges from "@/components/ZoneBadges";
import type { Interest } from "@/lib/types";

const INTERESTS: readonly Interest[] = [
  {
    id: "zone-1",
    userId: "user-1",
    coordinates: { lat: 42.6977, lng: 23.3219 },
    radius: 500,
    label: "Дом",
    color: "#1976D2",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

describe("ZoneBadges", () => {
  it("renders a primary add-zone CTA in empty state", () => {
    render(<ZoneBadges interests={[]} onAddZone={vi.fn()} />);

    const addButton = screen.getByRole("button", { name: "Добави зона" });
    expect(addButton).toHaveClass("bg-primary");
    expect(addButton).toHaveClass("text-white");
  });

  it("renders a primary add-zone CTA in non-empty state", () => {
    render(<ZoneBadges interests={INTERESTS} onAddZone={vi.fn()} />);

    const addButton = screen.getByRole("button", { name: "Добави зона" });
    expect(addButton).toHaveClass("bg-primary");
    expect(addButton).toHaveClass("text-white");
  });

  it("keeps add-zone action disabled when requested", () => {
    render(
      <ZoneBadges interests={INTERESTS} onAddZone={vi.fn()} addZoneDisabled />,
    );

    const addButton = screen.getByRole("button", { name: "Добави зона" });
    expect(addButton).toBeDisabled();
    expect(addButton).toHaveClass("disabled:opacity-50");
    expect(addButton).toHaveClass("disabled:cursor-not-allowed");
  });

  it("calls onZoneClick with the correct interest when a badge is clicked", async () => {
    const onZoneClick = vi.fn();
    render(
      <ZoneBadges
        interests={INTERESTS}
        onAddZone={vi.fn()}
        onZoneClick={onZoneClick}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Дом/i }));

    expect(onZoneClick).toHaveBeenCalledTimes(1);
    expect(onZoneClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "zone-1", label: "Дом" }),
    );
  });
});
