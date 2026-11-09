interface IncidentIdentity {
  AccidentId: string;
  ContentItemId: string;
}

function parseIdentity(json: string): IncidentIdentity {
  const info: unknown = JSON.parse(json);

  if (
    typeof info !== "object" ||
    info === null ||
    !("AccidentId" in info) ||
    typeof info.AccidentId !== "string" ||
    info.AccidentId.trim().length === 0 ||
    !("ContentItemId" in info) ||
    typeof info.ContentItemId !== "string" ||
    info.ContentItemId.trim().length === 0
  ) {
    throw new Error("Toplo listing contains an incident without a valid identity");
  }

  return { AccidentId: info.AccidentId, ContentItemId: info.ContentItemId };
}

function readListedIds(html: string): Set<string> {
  const listedIds = new Set<string>();

  for (const [tag] of html.matchAll(/<li\b[^>]*>/gi)) {
    const classes = /\bclass\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (!classes?.split(/\s+/).includes("accident-container")) {
      continue;
    }

    const id = /\bdata-accidentid\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (!id?.trim()) {
      throw new Error("Toplo listing contains a row without an incident ID");
    }

    listedIds.add(id);
  }

  return listedIds;
}

/** Count the complete source listing before geometry or ingestion filtering. */
export function countListingIncidents(html: string): number {
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi);
  const incidentScript = scripts?.find((script) => {
    return script.includes("function parseAll()");
  });

  if (
    !incidentScript ||
    !html.includes("accident-list-homepage") ||
    !/\bid\s*=\s*["']accidentMap["']/i.test(html) ||
    !/<\/html\s*>/i.test(html)
  ) {
    throw new Error("Toplo response does not contain a complete incident listing");
  }

  const declaredCount = [...incidentScript.matchAll(/\bvar\s+info\s*=/g)].length;
  const records = [...incidentScript.matchAll(/\bvar\s+info\s*=\s*({[\s\S]*?})\s*if\s*\(geoJsonString/g)];

  if (records.length !== declaredCount) {
    throw new Error("Toplo listing contains incomplete incident metadata");
  }

  const listedIds = readListedIds(html);
  const accidentIds = new Set<string>();
  const contentIds = new Set<string>();

  for (const record of records) {
    const info = parseIdentity(record[1]);
    accidentIds.add(info.AccidentId);
    contentIds.add(info.ContentItemId);
  }

  if (
    accidentIds.size !== contentIds.size ||
    accidentIds.size !== listedIds.size ||
    [...accidentIds].some((id) => {
      return !listedIds.has(id);
    })
  ) {
    throw new Error("Toplo incident metadata does not match the visible listing");
  }

  return contentIds.size;
}
