import { DateTime } from 'luxon';

/**
 * Timezone utility module for consistent datetime handling
 * All weather and reservation times are managed in Asia/Manila timezone
 */

export const MANILA_TIMEZONE = 'Asia/Manila';

/**
 * Convert UTC timestamp to Manila DateTime
 * @param utcTimestamp Unix timestamp in seconds (OpenWeather API format)
 * @returns DateTime object in Manila timezone
 */
export function utcToManila(utcTimestamp: number): DateTime {
  return DateTime.fromSeconds(utcTimestamp, { zone: 'utc' }).setZone(MANILA_TIMEZONE);
}

/**
 * Get hour in Manila timezone from UTC timestamp
 * @param utcTimestamp Unix timestamp in seconds
 * @returns Hour (0-23) in Manila timezone
 */
export function getManilaHour(utcTimestamp: number): number {
  return utcToManila(utcTimestamp).hour;
}

/**
 * Get current time in Manila timezone
 * @returns DateTime object representing current time in Manila
 */
export function nowInManila(): DateTime {
  return DateTime.now().setZone(MANILA_TIMEZONE);
}

/**
 * Parse date string and hour into Manila DateTime
 * @param date Date object or string
 * @param hour Hour (0-23)
 * @returns DateTime object in Manila timezone
 */
export function createManilaDateTime(date: Date, hour: number): DateTime {
  const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
  return DateTime.fromISO(`${dateStr}T${hour.toString().padStart(2, '0')}:00:00`, {
    zone: MANILA_TIMEZONE
  });
}

/**
 * Parse ISO date string in Manila timezone
 * @param dateStr ISO date string (YYYY-MM-DD)
 * @returns DateTime object in Manila timezone
 */
export function parseInManila(dateStr: string): DateTime {
  return DateTime.fromISO(dateStr, { zone: MANILA_TIMEZONE });
}

/**
 * Convert Manila DateTime to JavaScript Date
 * @param manilaTime DateTime in Manila timezone
 * @returns JavaScript Date object
 */
export function toJsDate(manilaTime: DateTime): Date {
  return manilaTime.toJSDate();
}

/**
 * Format Manila DateTime to date string (YYYY-MM-DD)
 * @param manilaTime DateTime in Manila timezone
 * @returns Date string in YYYY-MM-DD format
 */
export function toDateString(manilaTime: DateTime): string {
  return manilaTime.toISODate() || '';
}
