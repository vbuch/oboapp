# Peach identity

OboApp uses a warm paper palette, compact controls and small comic details. The
identity keeps the established **OboApp** name and Sofia Sans typeface. The mark
is an open ink circle with a peach dot.

The theme applies to the existing navigation, cards, filters, dialogs, saved
zones and notification views. The home page keeps its map and message layout,
and Bulgarian text keeps the informal register.

## Theme implementation

[`peachColors`](../../web/lib/colors.ts) is the palette source. The root layout
places its values in `--peach-*` custom properties and sets
`data-obo-skin="peach"`. This is the default identity in development and
production.

[`globals.css`](../../web/app/globals.css) binds the palette to the existing
semantic Tailwind tokens. [`theme.ts`](../../web/lib/theme.ts) remains the shared
button API. [`peach.css`](../../web/app/peach.css) defines the paper surfaces,
compact sizes, interaction states and decorative details.

Use `data-surface="card"` on a card surface. It provides the common white paper,
warm outline, slightly uneven corners and a `2px 2px` offset shadow. Buttons and
links receive hover and keyboard focus feedback; informational card wrappers
keep a steady surface. This includes source cards, geocoding panels and source
profiles.

The existing map and zone colour definitions retain their domain roles. Category
UI colours use the peach palette through category custom properties.

## Main palette

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#FBF8F4` | Warm page and navigation canvas |
| `panel` | `#FFFFFF` | Header, cards and sheets |
| `ink` | `#342F2B` | Body text, primary button labels and strong outlines |
| `muted` | `#655E57` | Supporting text and timestamps |
| `accent` | `#FFC19F` | Primary button fill and filter tab |
| `hover` | `#FFB78F` | Primary button hover fill |
| `pressed` | `#F4AB7D` | Primary button pressed fill |
| `action` | `#8A4F36` | Links, focus outlines and selected control outlines |
| `selected` | `#F9E7DD` | Selected surfaces |
| `border` | `#857C73` | Card and control outlines |
| `divider` | `#E5DBD3` | Separators and quiet card shadows |
| `card-hover` | `#FFF4EC` | Interactive card hover fill |
| `filter-hover` | `#F8D9C6` | Filter row hover fill |
| `secondary` | `#EFE4D9` | Secondary dialog action fill |
| `secondary-border` | `#71645A` | Secondary action outline |
| `butter` | `#FFF0B3` | Soft logo backdrop |

Notices pair dark semantic ink with a light paper: warning uses `#80520C` on
`#FFF3CC`, information uses `#326D84` on `#E6F1F4`, success uses `#3D654E` on
`#E4F0E6`, and error uses `#A13832` on `#FBE8E4`. Darker hover tokens support
filled semantic actions. Destructive actions use the error family.

## Components and states

- **Header:** the mark is 36 px on small screens and 40 px from the `sm`
  breakpoint. A borderless organic shape sits behind it without adding layout
  space. The mark and wordmark share one home link. The wordmark remains usable
  if the logo cannot load.
- **Controls:** theme action controls have a 32 px minimum height on desktop,
  with 13 px text and a 20 px line height. Coarse-pointer and no-hover media
  queries raise the minimum target to 44 by 44 px. Segmented controls use the
  same 32/44 px sizing. These rules target theme controls, rather than resizing
  whole cards.
- **Cards:** the home message list retains 16 px card padding and 16 px gaps.
  Source cards retain their existing 24 px padding, 128 px logos and grid
  spacing. Hover changes the fill and outline over 160 ms while keeping the
  card rectangle and shadow offset steady.
- **Primary actions:** peach fill, ink text and a small ink shadow give the
  button a raised paper edge. Hover deepens the fill and shadow. Pressed buttons
  use the pressed fill and a smaller shadow. Secondary actions have their own
  warm fill and visible outline.
- **Categories:** familiar icons keep their meaning and gain a slightly stronger
  stroke. Chip paper varies in shape and small, stable rotations; labels, icons,
  keyboard focus and hit areas remain level.
- **Filters:** hover uses a clear peach tint and a 2 px underline in category ink
  or clay. A selected category keeps its category paper, border and checkmark.
  Hover, pressed and selected states remain distinct. Filter and section-heading
  transitions last 140 ms.
- **Keyboard focus:** a 3 px clay outline identifies focused controls. Filter
  rows, category chips and clipped event accordion triggers use inset outlines
  so their scrolling containers do not hide the ring.
- **Filter sheet and tab:** the tab overlaps the sheet by 2 px and shares its
  outline and one drop shadow. The closed tab and its shadow extend past the
  viewport edge. In the stacked map layout, the sheet height fits within the map
  so its first rows and footer stay reachable.

Reduced-motion rules remove the skin's control, card and filter transitions.
The loading mark pulses only when motion is permitted. Forced-colour rules use
system surfaces and outlines and remove decorative canvas dots and shadows.

## Logo and installed assets

[`web/public/logo.svg`](../../web/public/logo.svg) is the master mark. Regenerate
the icon family from the `web` directory:

```bash
pnpm exec tsx scripts/generate-brand-assets.mts
```

The script uses the existing Next.js Sharp dependency and generates:

- `logo.png` for bitmap consumers and social cards;
- a light-backed SVG favicon, 32 px PNG and ICO frames at 16, 32 and 48 px;
- an opaque peach 192/512 px installed icon and 180 px Apple icon;
- a transparent, single-colour 72 px notification badge.

The installed mark is scaled to 60% of the square canvas so its ring and corner
dot fit inside the central 80%-diameter maskable safe circle. The favicon has a
soft light backdrop for visibility on dark browser chrome. The manifest uses
white header chrome and the warm page background. Loading and social cards use
the same identity.

## Contrast and verification

The following ratios use the final opaque palette values and the WCAG relative
luminance formula. Ratios are rounded to two decimal places.

| Combination | Contrast |
| --- | ---: |
| Ink text on primary fill | 8.43:1 |
| Ink text on primary hover fill | 7.82:1 |
| Ink text on primary pressed fill | 6.91:1 |
| Clay action text on white | 6.46:1 |
| Clay action text on selected paper | 5.38:1 |
| Warning ink on warning paper | 6.05:1 |
| Information ink on information paper | 4.99:1 |
| Success ink on success paper | 5.65:1 |
| Error ink on error paper | 5.68:1 |
| Lowest category ink/paper pair, air quality | 4.57:1 |
| Lowest category underline on filter hover, air quality | 3.97:1 |
| Ink label on filter hover | 9.91:1 |
| Secondary outline on normal / hover / pressed fill | 4.57 / 3.92 / 3.32:1 |

[`peach-colors.test.ts`](../../web/lib/peach-colors.test.ts) guards normal text
at 4.5:1 and meaningful underline and boundary cues at 3:1. It also checks white
text on filled semantic actions and their hover states. Header tests cover the
default logo, combined home link and image-error fallback. Manifest tests check
the brand name, locality description and theme colours.

Preparation checks passed for shared and database builds, the production web
build, and lint and TypeScript in both ingest and web. All 3,270 tests passed:
shared 94, database 173, API 85, ingest 1,693 and web 1,225. Web lint reports 131
existing warnings and no errors. The database's opt-in Mongo pagination
integration test requires `DB_TEST_MONGODB_URI`; ingest uses its existing
integration-test exclusion.

The asset tests verify opaque maskable icons, their safe circle, the monochrome
notification badge and ICO sizes. A rendered social-card regression checks the
whole logo and Bulgarian text with network fetches disabled. Sofia Sans fonts
and their OFL licence are bundled in `web/lib/og-fonts` for this renderer.

During design review, browser checks covered filter hover and selection,
keyboard focus, source-card navigation, dialogs, notification details and saved
zones. Responsive checks included 320 and 390 CSS px layouts without horizontal
page overflow. Responsive viewport resizing does not establish touch-device
behaviour.

The production build was also checked at 1280 by 720 and 320 by 844 CSS px.
The default theme, combined logo/wordmark home link, source-card hover and
keyboard focus, filter-sheet fit and footer close action worked. The closed tab
started at x = -6 px and both pages had no horizontal overflow at 320 px. This
build used the repository's emulator configuration without running its backend,
so live data and authentication were not part of that production browser check.

These checks do not establish complete WCAG conformance. VoiceOver and TalkBack
were not tested. Browser verification of a native filter drag was inconclusive;
the existing drag-hook tests remain separate evidence. MessageCard still has
category buttons inside its outer button, an existing markup issue that needs a
separate accessibility change. The source-filter accessible name also changes
wording with selection and should be reviewed in that pass.

Sonar server findings and a quality-gate result were unavailable because the
session had no configured Sonar tool or CLI. Repository ESLint includes SonarJS
rules.
