import axios from 'axios';
import { utcToManila, createManilaDateTime, nowInManila } from '../utils/timezone.util';
import cacheService from './cacheService';

export interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  rainChance?: number; // Precipitation probability as percentage
  timestamp: Date;
  isMockData?: boolean; // Flag to indicate if this is mock/sample data
}

export interface WeatherForecast {
  date: string;
  hourlyForecast: Array<{
    hour: number;
    temperature: number;
    description: string;
    humidity: number;
    windSpeed: number;
    icon: string;
    rainChance?: number; // Precipitation probability as percentage
  }>;
}

export interface HourlyWeatherForecast {
  datetime: string; // ISO string
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  timeSlot: string; // "14:00 - 15:00"
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  rainChance?: number; // Precipitation probability as percentage
  suitability: {
    suitable: boolean;
    warnings: string[];
  };
}

class WeatherService {
  private readonly API_KEY: string;
  private readonly BASE_URL: string;
  private readonly LOCATION: {
    lat: number;
    lon: number;
  };

  constructor() {
    this.API_KEY = process.env.WEATHER_API_KEY || '';
    this.BASE_URL = process.env.WEATHER_API_BASE_URL || 'https://api.openweathermap.org/data/2.5';
    this.LOCATION = {
      lat: parseFloat(process.env.WEATHER_LAT || '15.087'),
      lon: parseFloat(process.env.WEATHER_LON || '120.6285')
    };
    
    if (!this.API_KEY) {
      console.warn('⚠️  OpenWeatherMap API key not found. Weather features will use mock data.');
    } else {
      console.log(`🌤️  Weather service initialized for coordinates: ${this.LOCATION.lat}, ${this.LOCATION.lon}`);
    }
  }

  /**
   * Get current weather for the tennis club location
   */
  async getCurrentWeather(): Promise<WeatherData | null> {
    const cacheKey = `weather:current:${this.LOCATION.lat},${this.LOCATION.lon}`;

    // Check cache first
    const cached = cacheService.get<WeatherData>(cacheKey);
    if (cached) {
      console.log('☁️  Returning cached current weather');
      return cached;
    }

    try {
      if (!this.API_KEY) {
        return this.getMockCurrentWeather();
      }

      const response = await axios.get(
        `${this.BASE_URL}/weather?lat=${this.LOCATION.lat}&lon=${this.LOCATION.lon}&appid=${this.API_KEY}&units=metric`
      );

      const data = response.data;
      const weatherData: WeatherData = {
        temperature: Math.round(data.main?.temp || 25),
        description: data.weather?.[0]?.description || 'Clear',
        humidity: data.main?.humidity || 60,
        windSpeed: Math.round((data.wind?.speed || 0) * 3.6), // Convert m/s to km/h
        icon: data.weather?.[0]?.icon || '01d',
        rainChance: data.pop ? Math.round(data.pop * 100) : undefined, // Convert probability to percentage
        timestamp: new Date()
      };

      // Cache for 5 minutes (300 seconds)
      cacheService.set(cacheKey, weatherData, 300);

      return weatherData;
    } catch (error) {
      console.error('Error fetching current weather:', error);
      return this.getMockCurrentWeather();
    }
  }

  /**
   * Get weather forecast for a specific date and time
   */
  async getWeatherForDateTime(date: Date, hour: number): Promise<WeatherData | null> {
    try {
      if (!this.API_KEY) {
        return this.getMockWeatherForDateTime(date, hour);
      }

      const response = await axios.get(
        `${this.BASE_URL}/forecast?lat=${this.LOCATION.lat}&lon=${this.LOCATION.lon}&appid=${this.API_KEY}&units=metric`
      );

      const forecasts = response.data.list;
      const targetManilaTime = createManilaDateTime(date, hour);
      const targetTimestamp = targetManilaTime.toSeconds();

      // Find the closest forecast to the target datetime using UTC timestamps
      const closestForecast = forecasts.reduce((closest: any, forecast: any) => {
        const forecastTimestamp = forecast.dt;
        const closestTimestamp = closest?.dt || 0;

        return Math.abs(forecastTimestamp - targetTimestamp) <
               Math.abs(closestTimestamp - targetTimestamp) ? forecast : closest;
      });

      if (closestForecast) {
        return {
          temperature: Math.round(closestForecast.main?.temp || 25),
          description: closestForecast.weather?.[0]?.description || 'Clear',
          humidity: closestForecast.main?.humidity || 60,
          windSpeed: Math.round((closestForecast.wind?.speed || 0) * 3.6), // Convert m/s to km/h
          icon: closestForecast.weather?.[0]?.icon || '01d',
          rainChance: closestForecast.pop ? Math.round(closestForecast.pop * 100) : undefined, // Convert probability to percentage
          timestamp: new Date()
        };
      }

      return null;
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      return this.getMockWeatherForDateTime(date, hour);
    }
  }

  /**
   * Get hourly weather forecast for next 48 hours during court operating hours
   */
  async getHourlyForecast(): Promise<HourlyWeatherForecast[]> {
    const cacheKey = `weather:hourly:${this.LOCATION.lat},${this.LOCATION.lon}`;

    // Check cache first
    const cached = cacheService.get<HourlyWeatherForecast[]>(cacheKey);
    if (cached) {
      console.log('☁️  Returning cached hourly forecast');
      return cached;
    }

    try {
      if (!this.API_KEY) {
        return this.getMockHourlyForecast();
      }

      const response = await axios.get(
        `${this.BASE_URL}/forecast?lat=${this.LOCATION.lat}&lon=${this.LOCATION.lon}&appid=${this.API_KEY}&units=metric`
      );

      const forecasts = response.data.list;
      const hourlyForecasts: HourlyWeatherForecast[] = [];

      forecasts.forEach((forecast: any) => {
        const manilaTime = utcToManila(forecast.dt);
        const hour = manilaTime.hour;

        // Only include court operating hours (5 AM - 10 PM)
        if (hour >= 5 && hour <= 22) {
          const date = manilaTime.toJSDate();
          const weatherData: WeatherData = {
            temperature: Math.round(forecast.main?.temp || 25),
            description: forecast.weather?.[0]?.description || 'Clear',
            humidity: forecast.main?.humidity || 60,
            windSpeed: Math.round((forecast.wind?.speed || 0) * 3.6),
            icon: forecast.weather?.[0]?.icon || '01d',
            rainChance: forecast.pop ? Math.round(forecast.pop * 100) : undefined,
            timestamp: date
          };

          const suitability = this.isWeatherSuitableForTennis(weatherData);

          hourlyForecasts.push({
            datetime: date.toISOString(),
            date: manilaTime.toISODate() || '',
            hour,
            timeSlot: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
            temperature: weatherData.temperature,
            description: weatherData.description,
            humidity: weatherData.humidity,
            windSpeed: weatherData.windSpeed,
            icon: weatherData.icon,
            rainChance: weatherData.rainChance,
            suitability
          });
        }
      });

      // Return next 48 hours of court operating time slots
      const result = hourlyForecasts.slice(0, 48);

      // Cache for 10 minutes (600 seconds)
      cacheService.set(cacheKey, result, 600);

      return result;
    } catch (error) {
      console.error('Error fetching hourly forecast:', error);
      return this.getMockHourlyForecast();
    }
  }

  /**
   * Get 5-day weather forecast for schedule display
   */
  async getFiveDayForecast(): Promise<WeatherForecast[]> {
    const cacheKey = `weather:forecast:${this.LOCATION.lat},${this.LOCATION.lon}`;

    // Check cache first
    const cached = cacheService.get<WeatherForecast[]>(cacheKey);
    if (cached) {
      console.log('☁️  Returning cached 5-day forecast');
      return cached;
    }

    try {
      if (!this.API_KEY) {
        return this.getMockFiveDayForecast();
      }

      const response = await axios.get(
        `${this.BASE_URL}/forecast?lat=${this.LOCATION.lat}&lon=${this.LOCATION.lon}&appid=${this.API_KEY}&units=metric`
      );

      const forecasts = response.data.list;
      const dailyForecasts: { [key: string]: WeatherForecast } = {};

      forecasts.forEach((forecast: any) => {
        const manilaTime = utcToManila(forecast.dt);
        const dateStr = manilaTime.toISODate();
        const hour = manilaTime.hour;

        if (!dateStr) return; // Safety check

        if (!dailyForecasts[dateStr]) {
          dailyForecasts[dateStr] = {
            date: dateStr,
            hourlyForecast: []
          };
        }

        // Only include court operating hours (5 AM - 10 PM)
        if (hour >= 5 && hour <= 22) {
          const dailyForecast = dailyForecasts[dateStr];
          if (dailyForecast) {
            dailyForecast.hourlyForecast.push({
              hour,
              temperature: Math.round(forecast.main?.temp || 25),
              description: forecast.weather?.[0]?.description || 'Clear',
              humidity: forecast.main?.humidity || 60,
              windSpeed: Math.round((forecast.wind?.speed || 0) * 3.6),
              icon: forecast.weather?.[0]?.icon || '01d',
              rainChance: forecast.pop ? Math.round(forecast.pop * 100) : undefined // Convert probability to percentage
            });
          }
        }
      });

      const result = Object.values(dailyForecasts).slice(0, 5);

      // Cache for 10 minutes (600 seconds)
      cacheService.set(cacheKey, result, 600);

      return result;
    } catch (error) {
      console.error('Error fetching 5-day forecast:', error);
      return this.getMockFiveDayForecast();
    }
  }

  /**
   * Check if weather conditions are suitable for tennis
   */
  isWeatherSuitableForTennis(weather: WeatherData): {
    suitable: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    let suitable = true;

    // Temperature checks
    if (weather.temperature < 15) {
      warnings.push('Cold temperature - consider wearing warm clothing');
      suitable = false;
    } else if (weather.temperature > 35) {
      warnings.push('High temperature - stay hydrated and take breaks');
    }

    // Weather condition checks
    const badWeatherConditions = ['rain', 'storm', 'thunderstorm', 'snow'];
    if (badWeatherConditions.some(condition => 
      weather.description.toLowerCase().includes(condition))) {
      warnings.push('Unfavorable weather conditions - court may be closed');
      suitable = false;
    }

    // Wind speed checks (convert km/h to more readable format)
    if (weather.windSpeed > 25) {
      warnings.push('High wind speed - may affect ball trajectory');
    }

    // Humidity checks
    if (weather.humidity > 80) {
      warnings.push('High humidity - may feel uncomfortable');
    }

    return { suitable, warnings };
  }

  /**
   * Mock current weather data for development/testing
   */
  private getMockCurrentWeather(): WeatherData {
    const temperatures = [28, 30, 32, 29, 31];
    const descriptions = ['clear sky', 'few clouds', 'scattered clouds', 'partly cloudy'];
    const icons = ['01d', '02d', '03d', '04d'];

    const tempIndex = Math.floor(Math.random() * temperatures.length);
    const descIndex = Math.floor(Math.random() * descriptions.length);
    const iconIndex = Math.floor(Math.random() * icons.length);

    return {
      temperature: temperatures[tempIndex]!,
      description: descriptions[descIndex]!,
      humidity: 60 + Math.floor(Math.random() * 20),
      windSpeed: 5 + Math.floor(Math.random() * 15),
      icon: icons[iconIndex]!,
      rainChance: Math.floor(Math.random() * 101), // 0-100% rain chance for mock data
      timestamp: new Date(),
      isMockData: true
    };
  }

  /**
   * Mock weather data for specific date/time
   */
  private getMockWeatherForDateTime(date: Date, hour: number): WeatherData {
    const baseTemp = 28;
    const tempVariation = hour < 12 ? -3 + (hour / 2) : 5 - ((hour - 12) / 2);
    
    return {
      temperature: Math.round(baseTemp + tempVariation + (Math.random() * 4 - 2)),
      description: hour >= 6 && hour <= 18 ? 'clear sky' : 'partly cloudy',
      humidity: 55 + Math.floor(Math.random() * 25),
      windSpeed: 8 + Math.floor(Math.random() * 12),
      icon: hour >= 6 && hour <= 18 ? '01d' : '01n',
      rainChance: Math.floor(Math.random() * 101), // 0-100% rain chance for mock data
      timestamp: new Date(),
      isMockData: true
    };
  }

  /**
   * Mock hourly forecast for development/testing
   */
  private getMockHourlyForecast(): HourlyWeatherForecast[] {
    const hourlyForecasts: HourlyWeatherForecast[] = [];
    const now = nowInManila();
    let currentHour = now.plus({ hours: 1 }).startOf('hour');

    // Generate 48 hours of forecasts during operating hours
    let addedHours = 0;
    while (addedHours < 48) {
      const hour = currentHour.hour;
      
      // Only include court operating hours (5 AM - 10 PM)
      if (hour >= 5 && hour <= 22) {
        const baseTemp = 28;
        const tempVariation = hour < 12 ? -3 + (hour / 2) : 5 - ((hour - 12) / 2);
        const temperature = Math.round(baseTemp + tempVariation + (Math.random() * 4 - 2));
        
        const weatherData: WeatherData = {
          temperature,
          description: hour >= 6 && hour <= 18 ? 'clear sky' : 'partly cloudy',
          humidity: 55 + Math.floor(Math.random() * 25),
          windSpeed: 8 + Math.floor(Math.random() * 12),
          icon: hour >= 6 && hour <= 18 ? '01d' : '01n',
          rainChance: Math.floor(Math.random() * 101),
          timestamp: currentHour.toJSDate(),
          isMockData: true
        };

        const suitability = this.isWeatherSuitableForTennis(weatherData);

        hourlyForecasts.push({
          datetime: currentHour.toISO() || '',
          date: currentHour.toISODate() || '',
          hour,
          timeSlot: `${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`,
          temperature: weatherData.temperature,
          description: weatherData.description,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed,
          icon: weatherData.icon,
          rainChance: weatherData.rainChance,
          suitability
        });
        
        addedHours++;
      }

      // Move to next hour
      currentHour = currentHour.plus({ hours: 1 });

      // Safety check to prevent infinite loop (7 days)
      if (currentHour.diff(now, 'days').days > 7) break;
    }

    return hourlyForecasts;
  }

  /**
   * Mock 5-day forecast for development/testing
   */
  private getMockFiveDayForecast(): WeatherForecast[] {
    const forecasts: WeatherForecast[] = [];
    const today = new Date();

    for (let i = 0; i < 5; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      if (!dateStr) continue; // Safety check

      const hourlyForecast = [];
      for (let hour = 5; hour <= 22; hour++) {
        hourlyForecast.push({
          hour,
          temperature: 26 + Math.floor(Math.random() * 8),
          description: hour >= 6 && hour <= 18 ? 'clear sky' : 'partly cloudy',
          humidity: 60 + Math.floor(Math.random() * 20),
          windSpeed: 8 + Math.floor(Math.random() * 10),
          icon: hour >= 6 && hour <= 18 ? '01d' : '01n',
          rainChance: Math.floor(Math.random() * 101) // 0-100% rain chance for mock data
        });
      }

      forecasts.push({
        date: dateStr,
        hourlyForecast
      });
    }

    return forecasts;
  }
}

export default new WeatherService();