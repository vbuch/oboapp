import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomeContent from "@/components/HomeContent";
import type { Interest } from "@/lib/types";

let isWideDesktopLayout = false;
let capturedMapContainerProps: Record<string, unknown> | null = null;
let capturedZoneListProps: Record<string, unknown> | null = null;
let authUser: { uid: string } | null = null;

const mockInterests: Interest[] = [
  {
    id: "interest-1",
    userId: "user-1",
    coordinates: { lat: 42.6977, lng: 23.3219 },
    radius: 500,
    label: "Зона",
    color: "#F97316",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
];

const selectedInterestState = {
  targetMode: { active: false },
  pendingNewInterest: null,
  selectedInterest: {
    id: "interest-1",
    userId: "user-1",
    coordinates: { lat: 42.6977, lng: 23.3219 },
    radius: 500,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  interestMenuPosition: { x: 100, y: 200 },
  handleInterestClick: vi.fn(),
  handleMoveInterest: vi.fn(),
  handleDeleteInterest: vi.fn(),
  handleStartAddInterest: vi.fn(),
  handleSaveInterest: vi.fn(),
  handleConfirmPendingInterest: vi.fn(),
  handleCancelPendingInterest: vi.fn(),
  handleCancelTargetMode: vi.fn(),
  handleCloseInterestMenu: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/MapContainer", () => ({
  default: (props: Record<string, unknown>) => {
    capturedMapContainerProps = props;
    return <div data-testid="map-container" />;
  },
}));

vi.mock("@/components/MessageDetailView", () => ({
  default: () => <div data-testid="message-detail-view" />,
}));

vi.mock("@/components/MessagesGrid", () => ({
  default: () => <div data-testid="messages-grid" />,
}));

vi.mock("@/components/InterestContextMenu", () => ({
  default: () => <div data-testid="interest-context-menu" />,
}));

vi.mock("@/components/FilterBox", () => ({
  default: () => <div data-testid="filter-box" />,
}));

vi.mock("@/components/GeolocationPrompt", () => ({
  default: () => <div data-testid="geolocation-prompt" />,
}));

vi.mock("@/components/onboarding/OnboardingPrompt", () => ({
  default: () => <div data-testid="onboarding-prompt" />,
}));

vi.mock("@/components/onboarding/AddZoneModal", () => ({
  default: () => <div data-testid="add-zone-modal" />,
}));

vi.mock("@/components/SegmentedControl", () => ({
  default: (props: {
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    onChange: (value: string) => void;
  }) => (
    <div data-testid="segmented-control">
      {props.options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={Boolean(option.disabled)}
          onClick={() => props.onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ZoneBadges", () => ({
  default: () => <div data-testid="zone-badges" />,
}));

vi.mock("@/components/ZoneList", () => ({
  default: (props: Record<string, unknown>) => {
    capturedZoneListProps = props;
    return <div data-testid="zone-list" />;
  },
}));

vi.mock("@/lib/hooks/useInterests", () => ({
  useInterests: () => ({
    interests: mockInterests,
    hasInitialized: true,
    addInterest: vi.fn(),
    updateInterest: vi.fn(),
    deleteInterest: vi.fn(),
  }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: authUser }),
}));

vi.mock("@/lib/hooks/useMessages", () => ({
  useMessages: () => ({
    messages: [],
    availableCategories: [],
    isLoading: false,
    error: null,
    handleBoundsChanged: vi.fn(),
    setSelectedCategories: vi.fn(),
    setSelectedSources: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useMapNavigation", () => ({
  useMapNavigation: () => ({
    initialMapCenter: null,
    centerMapFn: vi.fn(),
    mapInstance: null,
    handleMapReady: vi.fn(),
    handleAddressClick: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useInterestManagement", () => ({
  useInterestManagement: () => selectedInterestState,
}));

vi.mock("@/lib/hooks/useCategoryFilter", () => ({
  useCategoryFilter: () => ({
    isOpen: false,
    selectedCategories: new Set<string>(),
    categoryCounts: new Map<string, number>(),
    hasActiveFilters: false,
    isInitialLoad: false,
    isLoadingCounts: false,
    showArchived: false,
    togglePanel: vi.fn(),
    toggleCategory: vi.fn(),
    toggleShowArchived: vi.fn(),
    clearAllCategories: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useSourceFilter", () => ({
  useSourceFilter: () => ({
    selectedSources: new Set<string>(),
    sourceCounts: new Map<string, number>(),
    hasActiveFilters: false,
    isLoadingCounts: false,
    toggleSource: vi.fn(),
    clearAllSources: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: () => isWideDesktopLayout,
}));

vi.mock("@/lib/message-classification", () => ({
  classifyMessage: () => "active",
}));

vi.mock("@/lib/url-utils", () => ({
  createMessageUrl: () => "/",
}));

vi.mock("@/lib/geometry-utils", () => ({
  getFeaturesCentroid: () => null,
}));

vi.mock("@/lib/navigation-utils", () => ({
  navigateBackOrReplace: vi.fn(),
}));

vi.mock("@oboapp/shared", () => ({
  isValidMessageId: () => true,
}));

describe("HomeContent pivot behavior", () => {
  beforeEach(() => {
    capturedMapContainerProps = null;
    capturedZoneListProps = null;
    isWideDesktopLayout = false;
    authUser = null;
    vi.clearAllMocks();
  });

  it("passes desktop-wide map wiring and hides mobile interest menu", () => {
    isWideDesktopLayout = true;

    render(<HomeContent />);

    expect(capturedMapContainerProps).not.toBeNull();
    expect(capturedMapContainerProps?.interestsInteractive).toBe(false);
    expect(capturedMapContainerProps?.onInterestClick).toBeUndefined();
    expect(
      screen.queryByTestId("interest-context-menu"),
    ).not.toBeInTheDocument();
  });

  it("passes mobile map wiring and renders interest menu when selection exists", () => {
    isWideDesktopLayout = false;

    render(<HomeContent />);

    expect(capturedMapContainerProps).not.toBeNull();
    expect(capturedMapContainerProps?.interestsInteractive).toBe(true);
    expect(capturedMapContainerProps?.onInterestClick).toEqual(
      expect.any(Function),
    );
    expect(screen.getByTestId("interest-context-menu")).toBeInTheDocument();
  });

  it("wires move/delete callbacks into ZoneList on authenticated desktop zones view", async () => {
    isWideDesktopLayout = true;
    authUser = { uid: "user-1" };

    render(<HomeContent />);
    await userEvent.click(screen.getByRole("button", { name: "Моите зони" }));

    expect(capturedZoneListProps).not.toBeNull();
    expect(capturedZoneListProps?.onMoveZone).toEqual(expect.any(Function));
    expect(capturedZoneListProps?.onDeleteZone).toEqual(expect.any(Function));
  });
});
