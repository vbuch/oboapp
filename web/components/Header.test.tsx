import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/components/UserMenu", () => ({ default: () => null }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));

describe("Header brand navigation", () => {
  it("uses the approved identity and one home link without a preview flag", () => {
    render(<Header />);

    const home = screen.getByRole("link", { name: "OboApp, начална страница" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveTextContent("OboApp");
    expect(within(home).getByAltText("")).toHaveAttribute(
      "src",
      expect.stringMatching(/\/logo\.svg$/),
    );
  });

  it("keeps wordmark navigation when the logo cannot load", () => {
    render(<Header />);

    const home = screen.getByRole("link", { name: "OboApp, начална страница" });
    fireEvent.error(within(home).getByAltText(""));

    expect(home).toHaveTextContent("OboApp");
    expect(home).toHaveAttribute("href", "/");
    expect(within(home).queryByAltText("")).not.toBeInTheDocument();
  });
});
