import { ImageResponse } from "next/og";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { peachColors } from "@/lib/colors";
import { buildOgCard, ogFonts } from "@/lib/og-card";

interface ImageDecoder {
  ensureAlpha: () => ImageDecoder;
  raw: () => ImageDecoder;
  toBuffer: (options: { resolveWithObject: true }) => Promise<{
    data: Buffer;
    info: { width: number; height: number; channels: number };
  }>;
}

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp: (image: Buffer) => ImageDecoder = nextRequire("sharp");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("social card rendering", () => {
  it("renders Bulgarian text and the logo without external asset requests", async () => {
    const remoteFetch = vi.fn(() => {
      throw new Error("External assets are unavailable");
    });
    vi.stubGlobal("fetch", remoteFetch);

    const response = new ImageResponse(
      buildOgCard("Следи събитията около теб в София"),
      { width: 1200, height: 630, fonts: ogFonts },
    );
    const image = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(image.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
    expect(remoteFetch).not.toHaveBeenCalled();

    const { data, info } = await sharp(image)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ink = [1, 3, 5].map((offset) => {
      return Number.parseInt(peachColors.ink.slice(offset, offset + 2), 16);
    });
    let logoInkPixels = 0;

    // Inspect the logo's own box, before the wordmark. An unscaled background
    // crops the 512 px source to a small wedge instead of the complete ring.
    for (let y = 195; y < 355; y += 1) {
      for (let x = 350; x < 510; x += 1) {
        const offset = (y * info.width + x) * info.channels;
        if (
          ink.every((channel, index) => {
            return Math.abs(data[offset + index] - channel) <= 2;
          })
        ) {
          logoInkPixels += 1;
        }
      }
    }

    expect(logoInkPixels).toBeGreaterThan(5000);
  }, 10_000);
});
