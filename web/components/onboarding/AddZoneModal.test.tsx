import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddZoneModal from "@/components/onboarding/AddZoneModal";
import { ZONE_TYPES } from "@/lib/zoneTypes";

describe("AddZoneModal", () => {
  it("renders all zone type options", () => {
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={vi.fn()} />);
    for (const type of ZONE_TYPES) {
      expect(screen.getByText(type.label)).toBeInTheDocument();
    }
  });

  it("renders the radius slider with default value 500", () => {
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const slider = screen.getByRole("slider", { name: /радиус/i });
    expect(slider).toHaveValue("500");
    expect(screen.getByText("500 м")).toBeInTheDocument();
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const onCancel = vi.fn();
    render(<AddZoneModal onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: /отказ/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm with selected zone type and default radius", async () => {
    const onConfirm = vi.fn();
    render(<AddZoneModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.click(
      screen.getByRole("button", { name: /избери на картата/i }),
    );
    expect(onConfirm).toHaveBeenCalledWith({
      label: ZONE_TYPES[0].label,
      color: ZONE_TYPES[0].color,
      radius: 500,
    });
  });

  it("calls onConfirm with the newly selected zone type", async () => {
    const onConfirm = vi.fn();
    render(<AddZoneModal onConfirm={onConfirm} onCancel={vi.fn()} />);
    // Select "Офис" (second zone type)
    await userEvent.click(screen.getByText(ZONE_TYPES[1].label));
    await userEvent.click(
      screen.getByRole("button", { name: /избери на картата/i }),
    );
    expect(onConfirm).toHaveBeenCalledWith({
      label: ZONE_TYPES[1].label,
      color: ZONE_TYPES[1].color,
      radius: 500,
    });
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
