import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import UserMenu from "@/components/UserMenu";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: authMock.useAuth,
}));

describe("UserMenu", () => {
  const signOut = vi.fn();
  const signInWithGoogle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    authMock.useAuth.mockReturnValue({
      user: {
        uid: "user-1",
        email: "user@example.com",
        displayName: "Test User",
        isAnonymous: false,
      },
      guestAuthUnavailable: false,
      signOut,
      signInWithGoogle,
    });
  });

  it("renders panel above backdrop using z-index classes", () => {
    render(<UserMenu id="header-user-menu" isOpen onClose={vi.fn()} />);

    const backdrop = screen
      .getAllByRole<HTMLButtonElement>("button", { name: "Затвори менюто" })
      .find((element) => element.className.includes("z-30"));
    const panel = screen.getByRole("dialog");

    expect(backdrop).toBeDefined();
    if (backdrop) {
      expect(backdrop.className).toContain("z-30");
      expect(panel.className).toContain("z-40");
    }
  });

  it("allows clicking logout action", () => {
    const onClose = vi.fn();
    render(<UserMenu id="header-user-menu" isOpen onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Излез" }));

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
