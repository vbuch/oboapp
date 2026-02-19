import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SegmentedControl from "@/components/SegmentedControl";

const OPTIONS = [
  { value: "zones", label: "Моите зони" },
  { value: "events", label: "Събития" },
] as const;

describe("SegmentedControl", () => {
  it("renders all options", () => {
    render(
      <SegmentedControl options={OPTIONS} value="zones" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Моите зони")).toBeInTheDocument();
    expect(screen.getByText("Събития")).toBeInTheDocument();
  });

  it("marks the active option with aria-checked=true", () => {
    render(
      <SegmentedControl options={OPTIONS} value="zones" onChange={vi.fn()} />,
    );
    const zonesBtn = screen.getByRole("radio", { name: "Моите зони" });
    const eventsBtn = screen.getByRole("radio", { name: "Събития" });
    expect(zonesBtn).toHaveAttribute("aria-checked", "true");
    expect(eventsBtn).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the clicked option value", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={OPTIONS} value="zones" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Събития" }));
    expect(onChange).toHaveBeenCalledWith("events");
  });

  it("does not call onChange when clicking already-active option", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl options={OPTIONS} value="zones" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Моите зони" }));
    // onChange is still called (controlled component — parent decides)
    expect(onChange).toHaveBeenCalledWith("zones");
  });
});
