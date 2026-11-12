import { readFileSync } from "node:fs";
import { join } from "node:path";
import { peachColors } from "@/lib/colors";
import { APP_NAME } from "@/lib/pwa-metadata";

const logoBuffer = readFileSync(join(process.cwd(), "public/logo.png"));
const logoBackground = `url(data:image/png;base64,${logoBuffer.toString("base64")})`;

interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

export const ogFonts: OgFont[] = [
  {
    name: "Sofia Sans",
    data: readFileSync(join(process.cwd(), "lib/og-fonts/SofiaSans-Regular.ttf")),
    weight: 400,
    style: "normal",
  },
  {
    name: "Sofia Sans",
    data: readFileSync(join(process.cwd(), "lib/og-fonts/SofiaSans-Bold.ttf")),
    weight: 700,
    style: "normal",
  },
];

/** Shared social card rendered by next/og in the Node.js runtime. */
export function buildOgCard(tagline: string) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: peachColors.background,
        color: peachColors.ink,
        position: "relative",
        padding: "64px",
        fontFamily: "Sofia Sans",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "12px",
          backgroundColor: peachColors.accent,
          display: "flex",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <div
          aria-hidden="true"
          style={{
            display: "flex",
            width: "148px",
            height: "148px",
            backgroundImage: logoBackground,
            backgroundSize: "148px 148px",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: "-2px",
          }}
        >
          {APP_NAME}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: "960px",
          fontSize: 36,
          lineHeight: 1.3,
          color: peachColors.muted,
          marginTop: 36,
          textAlign: "center",
        }}
      >
        {tagline}
      </div>
    </div>
  );
}
