# Geocoding

The router ([`router.ts`](router.ts)) dispatches each location type extracted from a message to the provider declared for that locality. Providers are configured in `localities/{locality}.yaml` — see [`lib/locality-data-sources.ts`](../lib/locality-data-sources.ts).

| Location type                  | Supported providers                        | Output                                      |
| ------------------------------ | ------------------------------------------ | ------------------------------------------- |
| Specific address (pin)         | `google`, `overpass`                       | Point                                       |
| Street section                 | `overpass`, `google`                       | LineString                                  |
| Cadastral property (УПИ)       | `cadastre`, `skip`                         | Polygon (`cadastre`); no geometry otherwise |
| Bus stop code                  | `gtfs`, `google`, `overpass`, `skip`       | Point                                       |
| Educational facility reference | `educational-facilities`, `google`, `skip` | Point                                       |

`skip` disables geocoding for that type — the pipeline performs no lookup and returns no geometry for those locations.

All 5 resolver types are **required** in the locality YAML. The app fails at startup if any is absent or uses an unrecognised provider.

All results are validated against the configured locality boundary before use. Results outside the boundary are rejected.

## Geotagged coordinates

Some sources practice [geotagging](https://en.wikipedia.org/wiki/Geotagging) — embedding coordinates directly in their messages (e.g. Rayon Oborishte). When geotagged coordinates are present, geocoding is skipped for that location and the coordinates are used directly.

## Event-based skip

When [event matching](../lib/event-matching/) finds a high-quality match before geocoding, the matched event's geometry is reused and all geocoding API calls are skipped.

## Related

- [Message Ingest Pipeline](../messageIngest/README.md)
- [Location Extraction Prompt](../prompts/extract-locations.md)
