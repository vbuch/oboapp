import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SubscribeDevicePrompt from "@/app/settings/SubscribeDevicePrompt";

vi.mock("@/lib/platform-detection", () => ({
  getPlatformInfo: () => ({
    isIOS: false,
    isSafari: false,
    isIOSSafari: false,
    isPWA: false,
    supportsNotifications: true,
    requiresPWAInstall: false,
  }),
  getNotificationInstructions: () => "",
}));

describe("SubscribeDevicePrompt warning text", () => {
  it("shows device-specific wording for anonymous users", () => {
    render(
      <SubscribeDevicePrompt
        onSubscribe={vi.fn()}
        hasAnySubscriptions={false}
        isGuestUser
      />,
    );

    expect(
      screen.getByText(
        "Няма абонамент за известия на това устройство. Това е основната задача на OboApp. Абонирай се!",
      ),
    ).toBeInTheDocument();

    expect(
      screen.queryByText(
        "Няма абонамент за известия на нито едно устройство. Това е основната задача на OboApp. Абонирай се!",
      ),
    ).not.toBeInTheDocument();
  });

  it("shows all-devices wording for non-anonymous users", () => {
    render(
      <SubscribeDevicePrompt
        onSubscribe={vi.fn()}
        hasAnySubscriptions={false}
        isGuestUser={false}
      />,
    );

    expect(
      screen.getByText(
        "Няма абонамент за известия на нито едно устройство. Това е основната задача на OboApp. Абонирай се!",
      ),
    ).toBeInTheDocument();
  });
});
