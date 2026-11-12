import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { peachColors } from "@/lib/colors";

interface DecodedImage {
  data: Buffer;
  info: { width: number; height: number; channels: number };
}

interface ImageDecoder {
  ensureAlpha: () => ImageDecoder;
  raw: () => ImageDecoder;
  toBuffer: (options: { resolveWithObject: true }) => Promise<DecodedImage>;
}

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp: (input: Buffer) => ImageDecoder = nextRequire("sharp");
const publicDirectory = resolve(process.cwd(), "public");

function readAsset(name: string): Buffer {
  return readFileSync(resolve(publicDirectory, name));
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((offset) => {
    return Number.parseInt(hex.slice(offset, offset + 2), 16);
  });
}

describe("PWA identity assets", () => {
  it.each([192, 512])(
    "keeps the complete %d px installed mark inside the maskable safe circle",
    async (size) => {
      const { data, info } = await sharp(readAsset(`icon-${size}x${size}.png`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const background = rgb(peachColors.accent);
      let transparentPixels = 0;
      let markPixels = 0;
      let furthestMarkPixel = 0;

      expect(info).toMatchObject({ width: size, height: size, channels: 4 });

      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          const offset = (y * size + x) * 4;
          if (data[offset + 3] !== 255) {
            transparentPixels += 1;
          }
          if (
            data[offset] !== background[0] ||
            data[offset + 1] !== background[1] ||
            data[offset + 2] !== background[2]
          ) {
            markPixels += 1;
            furthestMarkPixel = Math.max(
              furthestMarkPixel,
              Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2),
            );
          }
        }
      }

      expect(transparentPixels).toBe(0);
      expect(markPixels).toBeGreaterThan(size * size * 0.08);
      expect(furthestMarkPixel).toBeLessThanOrEqual(size * 0.4);
    },
  );

  it("provides a transparent monochrome notification badge", async () => {
    const { data, info } = await sharp(readAsset("icon-72x72.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const ink = rgb(peachColors.ink);
    let transparentPixels = 0;
    let solidPixels = 0;
    let unexpectedSolidPixels = 0;

    expect(info).toMatchObject({ width: 72, height: 72, channels: 4 });

    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3] === 0) {
        transparentPixels += 1;
      }
      if (data[offset + 3] === 255) {
        solidPixels += 1;
        const differsFromInk = ink.some((channel, index) => {
          return Math.abs(data[offset + index] - channel) > 1;
        });
        if (differsFromInk) {
          unexpectedSolidPixels += 1;
        }
      }
    }

    expect(transparentPixels).toBeGreaterThan(0);
    expect(solidPixels).toBeGreaterThan(0);
    expect(unexpectedSolidPixels).toBe(0);
  });

  it("ships matching multi-size favicon files for public and Next.js routes", () => {
    const ico = readAsset("favicon.ico");
    const appIco = readFileSync(resolve(process.cwd(), "app/favicon.ico"));
    expect(appIco).toEqual(ico);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(3);

    for (const [index, size] of [16, 32, 48].entries()) {
      const entry = 6 + index * 16;
      const imageSize = ico.readUInt32LE(entry + 8);
      const imageOffset = ico.readUInt32LE(entry + 12);
      const png = ico.subarray(imageOffset, imageOffset + imageSize);
      expect(ico[entry]).toBe(size);
      expect(ico[entry + 1]).toBe(size);
      expect(png.subarray(0, 8)).toEqual(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      );
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });

  it("keeps the vector favicon small with a light backdrop for dark chrome", () => {
    const favicon = readAsset("favicon.svg").toString("utf8");
    expect(favicon).not.toContain("<image");
    expect(favicon).not.toContain("base64");
    expect(favicon).toContain(peachColors.butter);
    expect(Buffer.byteLength(favicon)).toBeLessThan(2048);
  });
});
