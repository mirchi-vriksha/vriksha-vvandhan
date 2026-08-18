import "server-only";

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsAt(date: Date, timeZone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedMidnightAfter(date: Date, timeZone: string): Date {
  const current = partsAt(date, timeZone);
  const nextCalendarDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const target = {
    year: nextCalendarDay.getUTCFullYear(),
    month: nextCalendarDay.getUTCMonth() + 1,
    day: nextCalendarDay.getUTCDate(),
  };
  let candidate = new Date(Date.UTC(target.year, target.month - 1, target.day));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const rendered = partsAt(candidate, timeZone);
    const renderedAsUtc = Date.UTC(rendered.year, rendered.month - 1, rendered.day, rendered.hour, rendered.minute, rendered.second);
    const targetAsUtc = Date.UTC(target.year, target.month - 1, target.day);
    candidate = new Date(candidate.getTime() + targetAsUtc - renderedAsUtc);
  }
  return candidate;
}

export function emailQuotaWindow(now: Date, timeZone: string): { quotaDate: string; nextWindow: string } {
  const current = partsAt(now, timeZone);
  const quotaDate = `${current.year.toString().padStart(4, "0")}-${current.month.toString().padStart(2, "0")}-${current.day.toString().padStart(2, "0")}`;
  return { quotaDate, nextWindow: zonedMidnightAfter(now, timeZone).toISOString() };
}
