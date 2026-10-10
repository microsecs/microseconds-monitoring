export type DateFilter = { range?: string; from?: string; to?: string; tz?: string };

// Interpret custom dates in the browser-provided IANA time zone.
// Intl resolves DST changes, including 23/25-hour days.
function localDateParts(timeZone: string) {
 return new Intl.DateTimeFormat("en-US", {
  timeZone,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hourCycle: "h23",
 });
}

function localMidnightUtc(year: number, month: number, day: number, timeZone: string): Date {
  const partsFormatter = localDateParts(timeZone);
  const wallMidnight = Date.UTC(year, month - 1, day);
  let timestamp = wallMidnight;
  // Resolve the UTC instant corresponding to local 00:00 on this date.
  // Iteration accounts for offsets that change at DST boundaries.
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      partsFormatter.formatToParts(new Date(timestamp)).map(p => [p.type, p.value])
    );
    const shownAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    const next = timestamp + wallMidnight - shownAsUtc;
    if (next === timestamp) break;
    timestamp = next;
  }
  return new Date(timestamp);
}

function parseCalendarDate(value: string, label: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw Error(`Invalid ${label} date`);
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)
    throw Error(`Invalid ${label} date`);
  return [year, month, day];
}

export function dateBounds(p: DateFilter) {
  const range = p.range || "30d";
  const now = new Date();
  let start: Date | undefined, end: Date | undefined;
  const durations: Record<string, number> = {
    "24h": 86400000, "7d": 7 * 86400000,
    "30d": 30 * 86400000, "90d": 90 * 86400000,
  };
  if (range in durations) {
    start = new Date(now.getTime() - durations[range]);
  } else if (range === "custom") {
    if (!p.from || !p.to) throw Error("Custom date range requires both From and To dates");
    const [fy, fm, fd] = parseCalendarDate(p.from, "start");
    const [ty, tm, td] = parseCalendarDate(p.to, "end");
    if (p.from > p.to) throw Error("Start date must be before or equal to end date");
    const timeZone = p.tz || "UTC";
    // Reject invalid or unsupported time zones instead of silently using the server zone.
    try { localDateParts(timeZone); } catch { throw Error("Invalid browser time zone"); }
    start = localMidnightUtc(fy, fm, fd, timeZone);
    // Exclusive upper bound: midnight of the next day in the same browser zone.
    const nextDay = new Date(Date.UTC(ty, tm - 1, td + 1));
    end = localMidnightUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), timeZone);
  } else if (range !== "all") {
    throw Error("Invalid date range");
  }
  return { start: start?.toISOString(), end: end?.toISOString() };
}
