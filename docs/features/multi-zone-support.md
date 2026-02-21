## Multi-Zone Support

Authenticated users can create multiple named zones of interest. Each zone has a **type**
(Дома, Офис, Родители, Училище, Фитнес, Друго) with a predefined color, and a configurable
radius (100–1000 m).

### Sidebar UI

When `complete`, the sidebar header shows a segmented control with two tabs:

| Tab            | Content                                                                 |
| -------------- | ----------------------------------------------------------------------- |
| **Моите зони** | `ZoneList` — clickable list of saved zones (color dot, label, radius)   |
| **Събития**    | `MessagesGrid` — all messages visible in the map viewport              |


A "Добави зона" button (visible only in the zones tab) opens the `AddZoneModal`.

### Zone Creation Flow

1. User clicks "Добави зона" → `AddZoneModal` opens with a 3×2 grid of zone types and a radius slider.
2. User picks a type and radius, clicks confirm → modal closes, map enters **target mode**.
3. User clicks the map to place the zone (no preview circle until first click).
4. Control panel shows coordinates, radius slider, and save/cancel buttons.
5. On save, the zone is persisted via `POST /api/interests` with `label` and `color`.

### Zone Editing & Deletion

Right-clicking (or tapping) a zone circle on the map opens `InterestContextMenu`
with **Move** and **Delete** actions. Move re-enters target mode with the existing
radius pre-filled.

### Interest Data Model

Zones are stored in the `interests` collection with these fields:

| Field         | Type     | Description                            |
| ------------- | -------- | -------------------------------------- |
| `userId`      | string   | Owner                                  |
| `coordinates` | {lat,lng}| Center of the zone                     |
| `radius`      | number   | Radius in meters (100–1000)            |
| `label`       | string?  | Zone type label (e.g. "Дома")          |
| `color`       | string?  | Hex color from zone type (e.g. "#3B82F6") |
| `createdAt`   | datetime | Creation timestamp                     |
| `updatedAt`   | datetime | Last update timestamp                  |

### Notifications

The notification pipeline matches messages against **all** of a user's zones.
A user receives at most one notification per message regardless of how many
zones it intersects (deduplicated by closest match distance).

### Map Rendering

Zone circles use native `google.maps.Circle` instances managed imperatively
(not via the `@react-google-maps/api` `<Circle>` component) to ensure
deterministic cleanup — no ghost circles on delete or radius change.
Each circle is color-coded to match its zone type.