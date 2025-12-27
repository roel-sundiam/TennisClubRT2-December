import Reservation from '../models/Reservation';
import weatherService from './weatherService';
import { IReservationDocument } from '../models/Reservation';

/**
 * Weather Refresh Service
 * Manages weather data freshness for reservations
 */

// Configuration constants
const STALENESS_THRESHOLD_HOURS = 12; // Weather older than 12 hours is considered stale
const MIN_REFRESH_INTERVAL_HOURS = 1; // Minimum 1 hour between refreshes (throttling)
const FORECAST_WINDOW_HOURS = 120; // Only refresh within 5 days (120 hours) of reservation

/**
 * Determine if weather data needs to be refreshed
 * @param reservation Reservation document to check
 * @returns true if weather should be refreshed
 */
export function shouldRefreshWeather(reservation: IReservationDocument): boolean {
  // No weather data at all - needs fetch
  if (!reservation.weatherForecast) {
    return true;
  }

  // Old format without lastFetched - needs refresh
  if (!reservation.weatherForecast.lastFetched) {
    return true;
  }

  const now = Date.now();
  const lastFetched = reservation.weatherForecast.lastFetched.getTime();
  const reservationTime = reservation.date.getTime();

  // Throttling: Don't refresh if last fetched within minimum interval
  const timeSinceLastFetch = now - lastFetched;
  const minIntervalMs = MIN_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;
  if (timeSinceLastFetch < minIntervalMs) {
    return false;
  }

  // Don't refresh if reservation is too far in the future (beyond forecast window)
  const timeUntilReservation = reservationTime - now;
  const forecastWindowMs = FORECAST_WINDOW_HOURS * 60 * 60 * 1000;
  if (timeUntilReservation > forecastWindowMs) {
    return false;
  }

  // Don't refresh if reservation is in the past
  if (timeUntilReservation < 0) {
    return false;
  }

  // Check if data is stale (older than threshold)
  const stalenessThresholdMs = STALENESS_THRESHOLD_HOURS * 60 * 60 * 1000;
  if (timeSinceLastFetch > stalenessThresholdMs) {
    return true;
  }

  return false;
}

/**
 * Refresh weather forecast for a specific reservation
 * @param reservationId Reservation ID to refresh
 * @returns Updated reservation document
 */
export async function refreshReservationWeather(
  reservationId: string
): Promise<IReservationDocument> {
  const reservation = await Reservation.findById(reservationId);

  if (!reservation) {
    throw new Error('Reservation not found');
  }

  // Fetch updated weather
  const weather = await weatherService.getWeatherForDateTime(
    reservation.date,
    reservation.timeSlot
  );

  if (weather) {
    // Update weather forecast with new data
    reservation.weatherForecast = {
      temperature: weather.temperature,
      description: weather.description,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      icon: weather.icon,
      rainChance: weather.rainChance,
      timestamp: weather.timestamp,
      lastFetched: new Date(),
      isMockData: weather.isMockData || false
    };

    await reservation.save();
    console.log(`🌤️  Refreshed weather for reservation ${reservationId}`);
  }

  return reservation;
}

/**
 * Batch refresh weather for upcoming reservations
 * Useful for scheduled background jobs
 * @param hoursAhead How many hours ahead to refresh (default 48)
 * @returns Statistics of refresh operation
 */
export async function refreshUpcomingReservations(
  hoursAhead: number = 48
): Promise<{ refreshed: number; failed: number }> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  // Find reservations in the time window
  const reservations = await Reservation.find({
    date: { $gte: now, $lte: futureDate },
    status: { $in: ['pending', 'confirmed'] }
  });

  let refreshed = 0;
  let failed = 0;

  for (const reservation of reservations) {
    if (shouldRefreshWeather(reservation)) {
      try {
        const reservationId = reservation._id?.toString() || '';
        if (reservationId) {
          await refreshReservationWeather(reservationId);
          refreshed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to refresh reservation ${reservation._id}:`, error);
        failed++;
      }
    }
  }

  console.log(`🌤️  Batch refresh complete: ${refreshed} refreshed, ${failed} failed`);

  return { refreshed, failed };
}

/**
 * Get human-readable age of weather data
 * @param lastFetched Last fetch timestamp
 * @returns String like "3 hours ago" or "just now"
 */
export function getWeatherAge(lastFetched?: Date): string {
  if (!lastFetched) {
    return 'unknown';
  }

  const now = Date.now();
  const ageMs = now - lastFetched.getTime();
  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  const ageHours = Math.floor(ageMinutes / 60);
  const ageDays = Math.floor(ageHours / 24);

  if (ageMinutes < 5) {
    return 'just now';
  } else if (ageMinutes < 60) {
    return `${ageMinutes} minute${ageMinutes !== 1 ? 's' : ''} ago`;
  } else if (ageHours < 24) {
    return `${ageHours} hour${ageHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${ageDays} day${ageDays !== 1 ? 's' : ''} ago`;
  }
}
