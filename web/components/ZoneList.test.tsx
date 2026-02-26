import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ZoneList from "@/components/ZoneList";
import type { Interest } from "@/lib/types";

const createInterest = (overrides: Partial<Interest> = {}): Interest => ({
  id: "zone-1",
  userId: "user-1",
  coordinates: { lat: 42.6977, lng: 23.3219 },
  radius: 500,
  label: "Зона",
  color: "#F97316",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

describe("ZoneList", () => {
  it("renders empty state when no zones exist", () => {
    render(<ZoneList interests={[]} />);

    expect(screen.getByText(/Нямате добавени зони/i)).toBeInTheDocument();
  });

  it("calls onZoneClick when clicking a zone row", async () => {
    const onZoneClick = vi.fn();
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onZoneClick={onZoneClick}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Вкъщи/i }));

    expect(onZoneClick).toHaveBeenCalledTimes(1);
    expect(onZoneClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "zone-1" }),
    );
  });

  it("opens context menu and triggers move action", async () => {
    const onMoveZone = vi.fn();
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onMoveZone={onMoveZone}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Действия за Вкъщи/i }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Премести/i }));

    expect(onMoveZone).toHaveBeenCalledTimes(1);
    expect(onMoveZone).toHaveBeenCalledWith(
      expect.objectContaining({ id: "zone-1" }),
    );
  });

  it("opens context menu and triggers delete action", async () => {
    const onDeleteZone = vi.fn();
    render(
      <ZoneList
        interests={[createInterest({ id: "zone-2", label: "Работа" })]}
        onDeleteZone={onDeleteZone}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Действия за Работа/i }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Изтрий/i }));

    expect(onDeleteZone).toHaveBeenCalledTimes(1);
    expect(onDeleteZone).toHaveBeenCalledWith(
      expect.objectContaining({ id: "zone-2" }),
    );
  });

  it("toggles trigger aria-expanded and exposes menu/menuitems roles", async () => {
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onMoveZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Действия за Вкъщи/i });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("menu", {
      name: /Меню с действия за Вкъщи/i,
    });
    expect(menu).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
  });

  it("closes menu on Escape and returns focus to trigger", async () => {
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onMoveZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Действия за Вкъщи/i });
    await userEvent.click(trigger);

    const moveItem = screen.getByRole("menuitem", { name: /Премести/i });
    moveItem.focus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("moves focus between menu items with ArrowDown and ArrowUp", async () => {
    const user = userEvent.setup();
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onMoveZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Действия за Вкъщи/i });
    await user.click(trigger);

    const moveItem = screen.getByRole("menuitem", { name: /Премести/i });
    const deleteItem = screen.getByRole("menuitem", { name: /Изтрий/i });

    moveItem.focus();
    await user.keyboard("{ArrowDown}");
    expect(deleteItem).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(moveItem).toHaveFocus();
  });

  it("opens menu with Enter and Space and focuses first menuitem", async () => {
    const user = userEvent.setup();
    render(
      <ZoneList
        interests={[createInterest({ label: "Вкъщи" })]}
        onMoveZone={vi.fn()}
        onDeleteZone={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Действия за Вкъщи/i });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Премести/i })).toHaveFocus();
    });

    await user.keyboard("{Escape}");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: " " });

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Премести/i })).toHaveFocus();
    });
  });
});
