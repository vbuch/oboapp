import { parseBulgarianDateTime } from "../shared/date-utils";
import { validateTimespanRange } from "@/lib/timespan-utils";
import type { PinRecord } from "./types";

/**
 * Parse and validate timespans from pin record
 * Returns validated start/end dates or defaults to current time if parsing fails
 */
export function parseTimespans(pin: PinRecord): {
  timespanStart: Date;
  timespanEnd: Date;
} {
  const now = new Date();
  let timespanStart = now;
  let timespanEnd = now;

  // Parse start time
  try {
    if (pin.begin_event) {
      const parsed = parseBulgarianDateTime(pin.begin_event);
      if (validateTimespanRange(parsed)) {
        timespanStart = parsed;
      } else {
        console.warn(
          `   ⚠️  begin_event outside valid range for ${pin.eventId}: ${pin.begin_event}`,
        );
      }
    }
  } catch (error) {
    console.warn(
      `   ⚠️  Invalid begin_event for ${pin.eventId}: ${pin.begin_event} - ${error}`,
    );
  }

  // Parse end time
  try {
    if (pin.end_event) {
      const parsed = parseBulgarianDateTime(pin.end_event);
      if (validateTimespanRange(parsed)) {
        timespanEnd = parsed;
      } else {
        console.warn(
          `   ⚠️  end_event outside valid range for ${pin.eventId}: ${pin.end_event}`,
        );
        timespanEnd = timespanStart;
      }
    } else if (pin.begin_event) {
      // Use start for both if only start available
      timespanEnd = timespanStart;
    }
  } catch (error) {
    console.warn(
      `   ⚠️  Invalid end_event for ${pin.eventId}: ${pin.end_event} - ${error}`,
    );
    timespanEnd = timespanStart;
  }

  return { timespanStart, timespanEnd };
}
