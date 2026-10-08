/** Returns the YYYY-MM-DD calendar date for `date` as observed in `timeZone` (e.g. "America/Los_Angeles"). */
export function eventDayFor(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD
  return formatter.format(date);
}
