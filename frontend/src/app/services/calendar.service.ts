import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, forkJoin, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Reservation {
  _id: string;
  userId: string | { _id: string; username: string; fullName: string };
  date: string;
  timeSlot: number;
  endTimeSlot: number;
  duration: number;
  isMultiHour: boolean;
  timeSlotDisplay: string;
  players: any[];
  totalFee: number;
  feePerPlayer: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show' | 'blocked';
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'not_applicable';
  weatherForecast?: any;
  blockReason?: 'maintenance' | 'private_event' | 'weather' | 'other';
  blockNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DayReservationInfo {
  date: Date;
  reservations: Reservation[];
  activeCount: number; // confirmed + pending
  blockedCount: number;
  totalHours: number;
  hasAvailability: boolean;
  isPeakDay: boolean; // Has peak hours
  isWednesday: boolean;
  maxRainChance?: number; // Highest rain probability from all reservations (0-100)
  hasWeatherData: boolean; // True if at least one reservation has weather data
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';
  private monthDataSubject = new BehaviorSubject<Map<string, DayReservationInfo>>(new Map());
  public monthData$ = this.monthDataSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Fetch all reservations for a given month
   */
  getMonthReservations(year: number, month: number): Observable<Map<string, DayReservationInfo>> {
    // Month is 0-indexed in JavaScript Date
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Last day of month

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Fetch both reservations and weather forecast in parallel
    const reservations$ = this.http.get<any>(`${this.apiUrl}/reservations`, {
      params: {
        dateFrom: startDateStr,
        dateTo: endDateStr,
        populate: 'userId', // Request user data to be populated
        limit: '1000', // Get all reservations for the month (no pagination)
        showAll: 'true' // Show all users' reservations (not just mine)
      }
    });

    const weather$ = this.http.get<any>(`${this.apiUrl}/weather/forecast`).pipe(
      catchError(error => {
        console.warn('Weather forecast unavailable:', error);
        return of({ forecast: [] }); // Return empty forecast on error
      })
    );

    return forkJoin({
      reservations: reservations$,
      weather: weather$
    }).pipe(
      map(({ reservations, weather }) => {
        const reservationData = reservations.success && reservations.data ? reservations.data : [];
        const weatherForecast = weather.forecast || [];

        return this.processMonthData(reservationData, year, month, weatherForecast);
      }),
      tap(data => this.monthDataSubject.next(data))
    );
  }

  /**
   * Process raw reservation data into daily summaries
   */
  private processMonthData(reservations: Reservation[], year: number, month: number, weatherForecast: any[] = []): Map<string, DayReservationInfo> {
    console.log(`🔧 Processing ${reservations.length} reservations for ${month + 1}/${year}`);
    console.log(`🌤️  Processing ${weatherForecast.length} days of weather forecast`);

    const dayMap = new Map<string, DayReservationInfo>();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const peakHours = [5, 18, 19, 20, 21]; // 5AM, 6PM, 7PM, 8PM, 9PM

    // Create a map of weather data by date
    const weatherMap = new Map<string, any>();
    weatherForecast.forEach(dayForecast => {
      if (dayForecast.date) {
        weatherMap.set(dayForecast.date, dayForecast);
      }
    });

    console.log(`🔧 Days in month: ${daysInMonth}`);

    // Initialize all days in the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateKey = this.getDateKey(date);
      const isWednesday = date.getDay() === 3;

      dayMap.set(dateKey, {
        date: date,
        reservations: [],
        activeCount: 0,
        blockedCount: 0,
        totalHours: 0,
        hasAvailability: true, // Will calculate below
        isPeakDay: false,
        isWednesday: isWednesday,
        maxRainChance: undefined,
        hasWeatherData: false
      });
    }

    console.log(`🔧 Initialized ${dayMap.size} days`);
    console.log(`🔧 Sample keys:`, Array.from(dayMap.keys()).slice(0, 5));

    // Populate with reservation data
    reservations.forEach(reservation => {
      const resDate = new Date(reservation.date);
      const dateKey = this.getDateKey(resDate);
      const dayInfo = dayMap.get(dateKey);

      if (dayInfo) {
        dayInfo.reservations.push(reservation);

        // Count only confirmed or pending reservations
        if (reservation.status === 'confirmed' || reservation.status === 'pending') {
          dayInfo.activeCount++;
          dayInfo.totalHours += reservation.duration;
        }

        if (reservation.status === 'blocked') {
          dayInfo.blockedCount++;
        }

        // Check if reservation includes peak hours
        for (let hour = reservation.timeSlot; hour < reservation.endTimeSlot; hour++) {
          if (peakHours.includes(hour)) {
            dayInfo.isPeakDay = true;
            break;
          }
        }

        // Calculate weather aggregation
        if (reservation.weatherForecast?.rainChance !== undefined) {
          const rainChance = reservation.weatherForecast.rainChance;

          // Update max rain chance
          if (dayInfo.maxRainChance === undefined || rainChance > dayInfo.maxRainChance) {
            dayInfo.maxRainChance = rainChance;
          }

          dayInfo.hasWeatherData = true;
        }
      }
    });

    // Calculate availability and add weather data from forecast for all days
    const totalHoursPerDay = 17;
    dayMap.forEach((dayInfo, dateKey) => {
      dayInfo.hasAvailability = dayInfo.totalHours < totalHoursPerDay;

      // If no weather data from reservations, try to get it from forecast
      if (!dayInfo.hasWeatherData && weatherMap.has(dateKey)) {
        const dayWeather = weatherMap.get(dateKey);
        if (dayWeather && dayWeather.hourlyForecast && dayWeather.hourlyForecast.length > 0) {
          // Calculate max rain chance from hourly forecasts
          const rainChances = dayWeather.hourlyForecast
            .map((h: any) => h.rainChance)
            .filter((rc: number | undefined) => rc !== undefined);

          if (rainChances.length > 0) {
            dayInfo.maxRainChance = Math.max(...rainChances);
            dayInfo.hasWeatherData = true;
          }
        }
      }
    });

    return dayMap;
  }

  /**
   * Get date key for map lookup (YYYY-MM-DD format)
   */
  getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get info for a specific day
   */
  getDayInfo(date: Date): DayReservationInfo | undefined {
    const monthData = this.monthDataSubject.value;
    return monthData.get(this.getDateKey(date));
  }

  /**
   * Clear cached month data
   */
  clearCache(): void {
    this.monthDataSubject.next(new Map());
  }

  /**
   * Get reserver name from reservation
   */
  getReserverName(reservation: Reservation): string {
    if (typeof reservation.userId === 'object' && reservation.userId !== null) {
      return reservation.userId.fullName || reservation.userId.username;
    }
    return 'Unknown';
  }
}
