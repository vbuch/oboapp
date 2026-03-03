import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UpgradeConflictPrompt from "@/components/onboarding/UpgradeConflictPrompt";

describe("UpgradeConflictPrompt", () => {
  it("traps keyboard focus inside the dialog", async () => {
    render(
      <div>
        <button type="button">Background action</button>
        <UpgradeConflictPrompt isLoading={false} onSelect={vi.fn()} />
      </div>,
    );

    const importButton = screen.getByRole("button", { name: "Импортирай" });
    const keepSeparateButton = screen.getByRole("button", {
      name: "Запази отделно",
    });
    const replaceButton = screen.getByRole("button", { name: "Замени" });

    await waitFor(() => {
      expect(importButton).toHaveFocus();
    });

    keepSeparateButton.focus();
    expect(keepSeparateButton).toHaveFocus();

    replaceButton.focus();
    expect(replaceButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab" });
    expect(importButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(replaceButton).toHaveFocus();
  });

  it("restores focus to the trigger after selecting an option", async () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(
        null,
      );

      return (
        <>
          <button
            ref={setTriggerElement}
            type="button"
            onClick={() => setIsOpen(true)}
          >
            Open prompt
          </button>
          {isOpen && (
            <UpgradeConflictPrompt
              isLoading={false}
              returnFocusElement={triggerElement}
              onSelect={() => setIsOpen(false)}
            />
          )}
        </>
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open prompt" });
  fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Импортирай" })).toHaveFocus();
    });

    fireEvent.click(screen.getByRole("button", { name: "Импортирай" }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("calls onClose when Escape is pressed and close is allowed", async () => {
    const onClose = vi.fn();

    render(
      <UpgradeConflictPrompt
        isLoading={false}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
