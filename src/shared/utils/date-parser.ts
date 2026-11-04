export interface ParsedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  isoLocal: string;
  sortKey: number;
}

/**
 * Checks whether a year is a Gregorian leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the maximum number of valid calendar days in a given month and year.
 */
export function getDaysInMonth(month: number, year: number): number {
  switch (month) {
    case 1: // January
    case 3: // March
    case 5: // May
    case 7: // July
    case 8: // August
    case 10: // October
    case 12: // December
      return 31;
    case 4: // April
    case 6: // June
    case 9: // September
    case 11: // November
      return 30;
    case 2: // February
      return isLeapYear(year) ? 29 : 28;
    default:
      return 0;
  }
}

/**
 * Strict calendar-valid parser for "DD/MM/YYYY HH:mm" timestamps.
 * Does not make assumptions about timezone (does not force UTC Z or local offset).
 * Throws an Error if the timestamp string is invalid or impossible.
 */
export function parsePortalTimestamp(timestampStr: string): ParsedDateTime {
  const trimmed = timestampStr.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(`Timestamp "${timestampStr}" does not match required format "DD/MM/YYYY HH:mm"`);
  }

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);

  if (year < 1900 || year > 2100) {
    throw new Error(`Year ${year} is outside acceptable range 1900-2100 in "${timestampStr}"`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Month ${month} is invalid in "${timestampStr}"`);
  }

  const maxDays = getDaysInMonth(month, year);
  if (day < 1 || day > maxDays) {
    throw new Error(`Day ${day} is invalid for month ${month}/${year} in "${timestampStr}"`);
  }

  if (hour < 0 || hour > 23) {
    throw new Error(`Hour ${hour} is invalid in "${timestampStr}"`);
  }

  if (minute < 0 || minute > 59) {
    throw new Error(`Minute ${minute} is invalid in "${timestampStr}"`);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoLocal = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
  const sortKey = Date.UTC(year, month - 1, day, hour, minute);

  return {
    year,
    month,
    day,
    hour,
    minute,
    isoLocal,
    sortKey
  };
}
