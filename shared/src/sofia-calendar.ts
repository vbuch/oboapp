const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function validateCalendarDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("Expected a valid calendar date in YYYY-MM-DD format");
  }
  return value;
}

export function getSofiaDateKey(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const fields = new Map(parts.map((part) => [part.type, part.value]));
  return `${fields.get("year")}-${fields.get("month")}-${fields.get("day")}`;
}

export function shiftCalendarDate(date: string, days: number): string {
  validateCalendarDate(date);
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function sofiaMidnight(date: string): string {
  const target = Date.parse(`${validateCalendarDate(date)}T00:00:00.000Z`);
  let candidate = target;

  for (let iteration = 0; iteration < 3; iteration++) {
    const fields = new Map(
      dateTimeFormatter.formatToParts(new Date(candidate)).map((part) => {
        return [part.type, part.value];
      }),
    );
    const represented = Date.UTC(
      Number(fields.get("year")),
      Number(fields.get("month")) - 1,
      Number(fields.get("day")),
      Number(fields.get("hour")),
      Number(fields.get("minute")),
      Number(fields.get("second")),
    );
    candidate += target - represented;
  }

  return new Date(candidate).toISOString();
}

/** UTC bounds for a Sofia calendar day, including daylight-saving changes. */
export function getSofiaDayRange(date: string): { start: string; end: string } {
  return {
    start: sofiaMidnight(date),
    end: sofiaMidnight(shiftCalendarDate(date, 1)),
  };
}
