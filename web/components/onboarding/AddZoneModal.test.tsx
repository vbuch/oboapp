import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddZoneModal from "@/components/onboarding/AddZoneModal";
import { ZONE_COLOR_OPTIONS, ZONE_LABEL_HINTS } from "@/lib/zoneTypes";

describe("AddZoneModal", () => {
  it("renders all label hints", () => {
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={vi.fn()} />);
    for (const hint of ZONE_LABEL_HINTS) {
      expect(screen.getByRole("button", { name: hint })).toBeInTheDocument();
    }
  });

  it("renders color options", () => {
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={vi.fn()} />);
    for (const color of ZONE_COLOR_OPTIONS) {
      expect(
        screen.getByRole("button", { name: color.label }),
      ).toBeInTheDocument();
    }
  });

  it("focuses the name input when opened", async () => {
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByLabelText(/име на зона/i)).toHaveFocus();
    });
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /отказ/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm with typed label and selected color", async () => {
    const onConfirm = vi.fn();
    render(<AddZoneModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/име на зона/i), "  Моя зона  ");
    await userEvent.click(
      screen.getByRole("button", { name: ZONE_COLOR_OPTIONS[1].label }),
    );
    await userEvent.click(screen.getByRole("button", { name: /запази зона/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      label: "Моя зона",
      color: ZONE_COLOR_OPTIONS[1].color,
    });
  });

  it("fills label from hint click", async () => {
    const onConfirm = vi.fn();
    render(<AddZoneModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: ZONE_LABEL_HINTS[0] }),
    );
    await userEvent.click(screen.getByRole("button", { name: /запази зона/i }));
    expect(onConfirm).toHaveBeenCalledWith({
      label: ZONE_LABEL_HINTS[0],
      color: ZONE_COLOR_OPTIONS[0].color,
    });
  });

  it("shows validation error when label is empty", async () => {
    const onConfirm = vi.fn();
    render(<AddZoneModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /запази зона/i }));
    expect(screen.getByText(/моля, въведете име на зона/i)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onCancel when the backdrop is clicked", async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <AddZoneModal onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    // The backdrop is the first fixed div with aria-hidden
    const backdrop = container.querySelector("[aria-hidden='true']");
    if (backdrop) {
      await userEvent.click(backdrop);
    }
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
