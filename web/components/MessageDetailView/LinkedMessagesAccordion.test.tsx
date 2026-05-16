import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LinkedMessagesAccordion from "./LinkedMessagesAccordion";

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: useQueryMock,
}));

vi.mock("@/lib/sources", () => ({
  default: [{ id: "sofiatraffic", name: "СофияТрафик" }],
}));

vi.mock("@/components/SourceLogo", () => ({
  default: ({ sourceId }: { sourceId: string }) => (
    <span data-testid={`logo-${sourceId}`} />
  ),
}));

const sibling = {
  id: "m2",
  text: "Свързано съобщение",
  markdownText: "Свързано съобщение",
  source: "sofiatraffic",
  locality: "bg.sofia",
  createdAt: "2026-05-01T00:00:00.000Z",
};

const eventMessage = {
  id: "em2",
  eventId: "evt1",
  messageId: "m2",
  source: "sofiatraffic",
  confidence: 0.85,
  geometryQuality: 2,
  createdAt: "2026-05-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LinkedMessagesAccordion", () => {
  it("renders nothing while loading", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: true });

    const { container } = render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no siblings after filtering current message", () => {
    useQueryMock.mockReturnValue({
      data: {
        messages: [{ ...sibling, id: "m1" }],
        eventMessages: [{ ...eventMessage, messageId: "m1" }],
      },
      isLoading: false,
    });

    const { container } = render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders an error message when the fetch fails", () => {
    useQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
    });

    render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    expect(
      screen.getByText(/Грешка при зареждане на свързаните съобщения\./),
    ).toBeInTheDocument();
  });

  it("renders nothing when sibling has no id", () => {
    useQueryMock.mockReturnValue({
      data: {
        messages: [{ ...sibling, id: undefined }],
        eventMessages: [],
      },
      isLoading: false,
    });

    const { container } = render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders collapsed toggle button showing sibling count when siblings exist", () => {
    useQueryMock.mockReturnValue({
      data: { messages: [sibling], eventMessages: [eventMessage] },
      isLoading: false,
    });

    render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    const button = screen.getByRole("button", {
      name: "Свързани съобщения (1)",
    });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("region", { hidden: true })).not.toBeVisible();
  });

  it("expands and shows sibling rows on click", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: { messages: [sibling], eventMessages: [eventMessage] },
      isLoading: false,
    });

    render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    await user.click(screen.getByRole("button", { name: "Свързани съобщения (1)" }));

    expect(screen.getByRole("region")).toBeVisible();
    expect(screen.getByText("Свързано съобщение")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
  });

  it("excludes the current message from the displayed list", () => {
    useQueryMock.mockReturnValue({
      data: {
        messages: [
          sibling,
          { ...sibling, id: "m1", text: "Текущо съобщение" },
        ],
        eventMessages: [
          eventMessage,
          { ...eventMessage, messageId: "m1" },
        ],
      },
      isLoading: false,
    });

    render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    expect(screen.getByRole("button", { name: "Свързани съобщения (1)" })).toBeInTheDocument();
    expect(screen.queryByText("Текущо съобщение")).not.toBeInTheDocument();
  });

  it("sibling rows are links to the message detail page", async () => {
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: { messages: [sibling], eventMessages: [eventMessage] },
      isLoading: false,
    });

    render(
      <LinkedMessagesAccordion eventId="evt1" currentMessageId="m1" />,
    );

    await user.click(screen.getByRole("button", { name: "Свързани съобщения (1)" }));

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/?messageId=m2");
  });
});
