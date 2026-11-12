/** Regenerate the icon family with: pnpm exec tsx scripts/generate-brand-assets.mts */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { peachColors } from "../lib/colors";

interface ImagePipeline {
  resize: (width: number, height: number) => ImagePipeline;
  composite: (
    layers: { input: Buffer; top: number; left: number }[],
  ) => ImagePipeline;
  png: () => ImagePipeline;
  toBuffer: () => Promise<Buffer>;
}

type ImageInput =
  | Buffer
  | {
      create: {
        width: number;
        height: number;
        channels: 4;
        background: string;
      };
    };

const webDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(webDirectory, "public");
const require = createRequire(import.meta.url);
// Next.js declares Sharp as an optional dependency used by its image pipeline.
const nextRequire = createRequire(require.resolve("next/package.json"));
const sharp: (input: ImageInput) => ImagePipeline = nextRequire("sharp");

async function renderPng(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function renderInstalledIcon(svg: string, size: number): Promise<Buffer> {
  // The corner dot also fits inside the central 80%-diameter maskable circle.
  const markSize = Math.round(size * 0.6);
  const mark = await renderPng(svg, markSize);
  const offset = Math.floor((size - markSize) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: peachColors.accent,
    },
  })
    .composite([{ input: mark, top: offset, left: offset }])
    .png()
    .toBuffer();
}

function createIco(frames: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let imageOffset = header.length;

  for (const [index, frame] of frames.entries()) {
    const entry = 6 + index * 16;
    header.writeUInt8(frame.size, entry);
    header.writeUInt8(frame.size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.png.length, entry + 8);
    header.writeUInt32LE(imageOffset, entry + 12);
    imageOffset += frame.png.length;
  }

  return Buffer.concat([header, ...frames.map((frame) => frame.png)]);
}

async function main(): Promise<void> {
  const svg = await readFile(resolve(publicDirectory, "logo.svg"), "utf8");
  // A soft light silhouette keeps the favicon visible on dark browser chrome.
  const faviconSvg = svg.replace(
    /(<svg[^>]*>)/u,
    `$1\n  <path d="M16 9C33 0 74-1 91 6C103 17 99 47 96 67C92 91 68 101 43 96C15 100-1 79 3 52C-2 31 2 18 16 9Z" fill="${peachColors.butter}"/>`,
  );
  const badgeSvg = svg.replace(/#[\dA-Fa-f]{6}/gu, peachColors.ink);

  await writeFile(resolve(publicDirectory, "favicon.svg"), faviconSvg);
  await writeFile(resolve(publicDirectory, "logo.png"), await renderPng(svg, 512));
  await writeFile(
    resolve(publicDirectory, "icon-32x32.png"),
    await renderPng(faviconSvg, 32),
  );
  // This existing URL is also used as the Android notification badge.
  await writeFile(
    resolve(publicDirectory, "icon-72x72.png"),
    await renderPng(badgeSvg, 72),
  );

  for (const size of [192, 512]) {
    await writeFile(
      resolve(publicDirectory, `icon-${size}x${size}.png`),
      await renderInstalledIcon(svg, size),
    );
  }

  await writeFile(
    resolve(publicDirectory, "apple-touch-icon.png"),
    await renderInstalledIcon(svg, 180),
  );

  const frames = [];
  for (const size of [16, 32, 48]) {
    frames.push({ size, png: await renderPng(faviconSvg, size) });
  }
  const ico = createIco(frames);
  await writeFile(resolve(publicDirectory, "favicon.ico"), ico);
  await writeFile(resolve(webDirectory, "app/favicon.ico"), ico);
}

await main();
