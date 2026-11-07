import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingViewSection } from "./LandingViewSection";

const STORAGE_KEY = "landingViewPreference:v1";

describe("LandingViewSection", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the default Events choice without storing a preference", () => {
    render(<LandingViewSection />);

    expect(screen.getByRole("radio", { name: "Събития" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Моите зони" })).not.toBeChecked();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText(/на това устройство/)).toBeInTheDocument();
  });

  it("saves My zones and allows the user to change back to Events", () => {
    render(<LandingViewSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Моите зони" }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("zones");
    expect(screen.getByRole("radio", { name: "Моите зони" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Събития" }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("events");
    expect(screen.getByRole("radio", { name: "Събития" })).toBeChecked();
  });

  it("restores the saved choice when settings reopen", () => {
    localStorage.setItem(STORAGE_KEY, "zones");

    render(<LandingViewSection />);

    expect(screen.getByRole("radio", { name: "Моите зони" })).toBeChecked();
  });

  it("shows a storage error and keeps the saved choice after a failed change", () => {
    localStorage.setItem(STORAGE_KEY, "events");
    const storedValues = localStorage;
    vi.stubGlobal("localStorage", {
      getItem: storedValues.getItem.bind(storedValues),
      setItem: () => {
        throw new Error("Storage unavailable");
      },
    });
    render(<LandingViewSection />);

    fireEvent.click(screen.getByRole("radio", { name: "Моите зони" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Настройката не се запази");
    expect(screen.getByRole("radio", { name: "Събития" })).toBeChecked();
  });
});
