import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "./route";
import { peachColors } from "@/lib/colors";
import { LOCALITY_ENV_ERROR_MESSAGE } from "@/lib/locality-metadata";

vi.mock("@oboapp/shared", () => ({
  getLocalityDescription: vi.fn().mockReturnValue("Следи събитията в София"),
}));

describe("GET /manifest.json", () => {
  const originalEnv = process.env.NEXT_PUBLIC_LOCALITY;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_LOCALITY;
    } else {
      process.env.NEXT_PUBLIC_LOCALITY = originalEnv;
    }
  });

  it("returns a valid manifest with locality description", async () => {
    process.env.NEXT_PUBLIC_LOCALITY = "bg.sofia";

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/manifest+json",
    );
    expect(data.name).toBe("OboApp");
    expect(data.short_name).toBe("OboApp");
    expect(data.description).toBe("Следи събитията в София");
    expect(data.start_url).toBe("/");
    expect(data.display).toBe("standalone");
    expect(data.theme_color).toBe(peachColors.panel);
    expect(data.background_color).toBe(peachColors.background);
    expect(Array.isArray(data.icons)).toBe(true);
    expect(data.icons.length).toBeGreaterThan(0);
  });

  it("calls getLocalityDescription with the configured locality", async () => {
    const { getLocalityDescription } = await import("@oboapp/shared");
    process.env.NEXT_PUBLIC_LOCALITY = "bg.sofia";

    await GET();

    expect(getLocalityDescription).toHaveBeenCalledWith("bg.sofia");
  });

  it("includes Cache-Control header", async () => {
    process.env.NEXT_PUBLIC_LOCALITY = "bg.sofia";

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("throws when NEXT_PUBLIC_LOCALITY is not set", async () => {
    delete process.env.NEXT_PUBLIC_LOCALITY;

    await expect(GET()).rejects.toThrow(LOCALITY_ENV_ERROR_MESSAGE);
  });
});
