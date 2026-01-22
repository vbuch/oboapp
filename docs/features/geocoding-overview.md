# Geocoding System Overview

## Overview

The geocoding system converts location descriptions from infrastructure announcements into map coordinates using four specialized services. Each service handles a specific type of location data: Google API for specific addresses, OpenStreetMap/Overpass for street intersections, Bulgarian Cadastre for property identifiers (УПИ), and GTFS for bus stops.

These geocoding services are publicly acknowledged on the [sources page](/sources) in the "Geocoding" section.

**Core Behavior**: A message stating "ул. Иван Вазов 15, между бул. Витоша и ул. Граф Игнатиев, УПИ 68134.1601.6124, спирка с код:1805" triggers all four geocoding services to map the pin location, street section, property boundary, and bus stop location.

## Architecture

The geocoding router dispatches location types to appropriate services based on the extracted data structure:

```mermaid
flowchart TD
    A[Extracted Locations] --> B{Geocoding Router}
    B --> C[Pins with Addresses]
    B --> D[Street Intersections]
    B --> E[Cadastral Properties УПИ]
    B --> F[Bus Stop Codes]

    C --> G[Google Geocoding API]
    D --> H[Overpass/OSM API]
    E --> I[Bulgarian Cadastre API]
    F --> J[GTFS Static Data]

    G --> K[Point Coordinates]
    H --> L[LineString Geometry]
    I --> M[Polygon Geometry]
    J --> N[Point Coordinates]

    K --> O[Sofia Boundary Check]
    L --> O
    M --> O
    N --> O

    O --> P{Within Sofia?}
    P -->|Yes| Q[Store Geocoding Result]
    P -->|No| R[Reject Coordinate]

    Q --> S[Convert to GeoJSON]
```

## Service Selection Logic

The router determines which geocoding service to use based on location type:

| Location Type            | Service                           | Example                                                       | Output              |
| ------------------------ | --------------------------------- | ------------------------------------------------------------- | ------------------- |
| Specific Address (pin)   | [Google](geocoding-google.md)     | "ул. Раковски 35"                                             | Point coordinate    |
| Street Section           | [Overpass](geocoding-overpass.md) | "ул. Граф Игнатиев между бул. Витоша и бул. Патриарх Евтимий" | LineString geometry |
| Cadastral Property (УПИ) | [Cadastre](geocoding-cadastre.md) | "УПИ с идентификатор 68134.1601.6124"                         | Polygon boundary    |
| Bus Stop                 | GTFS Static Data                  | "спирка с код:1805"                                           | Point coordinate    |

**Multiple Services**: A single message commonly triggers multiple services when it describes a construction site (УПИ), affected streets, a contact address, and nearby bus stops.

## Rate Limiting Strategy

Each service applies rate limiting to respect API terms and manage costs:

| Service                           | Delay  | Constant                   | Reason                                                 |
| --------------------------------- | ------ | -------------------------- | ------------------------------------------------------ |
| [Google](geocoding-google.md)     | 200ms  | `GEOCODING_BATCH_DELAY_MS` | API pricing and quota management                       |
| [Overpass](geocoding-overpass.md) | 500ms  | `OVERPASS_DELAY_MS`        | Fair use policy for free OSM APIs                      |
| [Cadastre](geocoding-cadastre.md) | 2000ms | `DELAY_BETWEEN_REQUESTS`   | Session management overhead and government API respect |
| GTFS                              | None   | -                          | Local Firestore data, no external API calls            |

## Sofia Boundary Validation

All geocoding services validate coordinates fall within Sofia city boundaries using `isWithinSofia()` boundary check:

- **Coordinates outside Sofia**: Rejected and logged as errors
- **Purpose**: Prevents displaying infrastructure disruptions from other Bulgarian cities
- **Boundary Definition**: Defined in `SOFIA_BOUNDS` constant (administrative boundaries)

**GTFS Boundary Check**: GTFS data is pre-filtered during daily sync - only bus stops within Sofia boundaries are stored in Firestore.

## GTFS Bus Stop Geocoding

Bus stops are geocoded using static GTFS data from Sofia's public transport system:

- **Data Source**: https://gtfs.sofiatraffic.bg/api/v1/static (ZIP file containing `stops.txt`)
- **Storage**: Firestore `gtfsStops` collection with stop_code as document ID
- **Precision**: Coordinates rounded to 6 decimal places (~0.11 meters)
- **Extraction**: AI categorization identifies bus stop codes (e.g., "спирка с код:1805")
- **Geocoding**: Lookup from Firestore during message processing (no external API calls)

## Related Documentation

- [Message Filtering](message-filtering.md) - AI-powered relevance filtering and extraction
- [Message Ingest Pipeline](../../ingest/messageIngest/README.md) - Complete processing pipeline
- [Data Extraction Prompt](../../ingest/prompts/data-extraction-overpass.md) - AI extraction rules for locations
