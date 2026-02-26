## Multi-Zone Support

Authenticated users can create multiple named zones of interest. Each zone has a **type**
(Вкъщи, Работа, Родители, Училище) with a user-chosen color, and a configurable
radius (100–1000 m).

### Sidebar UI

On wide-desktop layouts, authenticated users see a segmented control header with two tabs:

| Tab            | Content                                                               |
| -------------- | --------------------------------------------------------------------- |
| **Моите зони** | `ZoneList` — clickable list of saved zones (color dot, label, radius) |
| **Събития**    | `MessagesGrid` — all messages visible in the map viewport             |

A "Добави зона" button (visible only in the zones tab) puts the map into **target mode**
for creating a new zone; `AddZoneModal` is shown after the user places the zone on the map.

### Zone Creation Flow

1. User clicks "Добави зона" → the map enters **target mode** for placing a new zone.
2. User clicks the map to place the zone (no preview circle until first click).
3. Control panel shows coordinates, radius slider, and save/cancel buttons.
4. On save, `AddZoneModal` opens where the user picks a label and color.
5. On confirm, the zone is persisted via `POST /api/interests` with `label` and `color`.

### Zone Editing & Deletion

- **Desktop (wide layout):** Move/Delete actions are available from the zone item menu
  in `ZoneList` (side panel, "Моите зони" tab).
- **Mobile and narrower layouts:** tapping a zone circle on the map opens
  `InterestContextMenu` with **Move** and **Delete**.

Move re-enters target mode with the existing radius pre-filled.

### Interest Data Model

Zones are stored in the `interests` collection with these fields:

| Field         | Type      | Description                               |
| ------------- | --------- | ----------------------------------------- |
| `userId`      | string    | Owner                                     |
| `coordinates` | {lat,lng} | Center of the zone                        |
| `radius`      | number    | Radius in meters (100–1000)               |
| `label`       | string?   | Zone type label (e.g. "Вкъщи")            |
| `color`       | string?   | Hex color from zone type (e.g. "#4285F4") |
| `createdAt`   | datetime  | Creation timestamp                        |
| `updatedAt`   | datetime  | Last update timestamp                     |

### Notifications

The notification pipeline matches messages against **all** of a user's zones.
A user receives at most one notification per message regardless of how many
zones it intersects (deduplicated by closest match distance).

### Map Rendering

Zone circles use native `google.maps.Circle` instances managed imperatively
(not via the `@react-google-maps/api` `<Circle>` component) to ensure
deterministic cleanup — no ghost circles on delete or radius change.
Each circle is color-coded to match its zone type.
