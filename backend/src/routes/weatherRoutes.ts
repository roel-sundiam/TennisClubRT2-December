import { Router, Response } from 'express';
import weatherService from '../services/weatherService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { shouldRefreshWeather, refreshReservationWeather } from '../services/weatherRefreshService';
import Reservation from '../models/Reservation';

const router = Router();

/**
 * @route GET /api/weather/current
 * @desc Get current weather conditions
 * @access Private
 */
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const weather = await weatherService.getCurrentWeather();
    
    if (!weather) {
      return res.status(503).json({
        message: 'Weather service temporarily unavailable'
      });
    }

    const suitability = weatherService.isWeatherSuitableForTennis(weather);

    return res.json({
      weather,
      suitability,
      location: 'San Fernando, Pampanga',
      isMockData: weather.isMockData || false
    });
  } catch (error) {
    console.error('Error in GET /weather/current:', error);
    return res.status(500).json({
      message: 'Internal server error while fetching weather data'
    });
  }
});

/**
 * @route GET /api/weather/forecast
 * @desc Get 5-day weather forecast
 * @access Private
 */
router.get('/forecast', authenticateToken, async (req, res) => {
  try {
    const forecast = await weatherService.getFiveDayForecast();
    
    return res.json({
      forecast,
      location: 'San Fernando, Pampanga',
      generated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in GET /weather/forecast:', error);
    return res.status(500).json({
      message: 'Internal server error while fetching weather forecast'
    });
  }
});

/**
 * @route GET /api/weather/hourly
 * @desc Get hourly weather forecast for next 48 hours during court operating hours
 * @access Private
 */
router.get('/hourly', authenticateToken, async (req, res) => {
  try {
    const hourlyForecast = await weatherService.getHourlyForecast();
    
    if (!hourlyForecast || hourlyForecast.length === 0) {
      return res.status(503).json({
        message: 'Hourly weather forecast temporarily unavailable'
      });
    }

    return res.json({
      forecast: hourlyForecast,
      location: 'San Fernando, Pampanga',
      generated: new Date().toISOString(),
      timezone: 'Asia/Manila'
    });
  } catch (error) {
    console.error('Error in GET /weather/hourly:', error);
    return res.status(500).json({
      message: 'Internal server error while fetching hourly weather forecast'
    });
  }
});

/**
 * @route GET /api/weather/datetime/:date/:hour
 * @desc Get weather forecast for specific date and hour
 * @access Private
 */
router.get('/datetime/:date/:hour', authenticateToken, async (req, res) => {
  try {
    const { date, hour } = req.params;
    
    if (!date || !hour) {
      return res.status(400).json({
        message: 'Date and hour parameters are required.'
      });
    }
    
    // Validate date format
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({
        message: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }

    // Validate hour
    const targetHour = parseInt(hour);
    if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) {
      return res.status(400).json({
        message: 'Invalid hour. Must be between 0 and 23.'
      });
    }

    // Check if the requested time is within court operating hours
    if (targetHour < 5 || targetHour > 22) {
      return res.status(400).json({
        message: 'Court operating hours are 5:00 AM to 10:00 PM.'
      });
    }

    const weather = await weatherService.getWeatherForDateTime(targetDate, targetHour);
    
    if (!weather) {
      return res.status(404).json({
        message: 'Weather forecast not available for the requested date/time'
      });
    }

    const suitability = weatherService.isWeatherSuitableForTennis(weather);

    return res.json({
      date: date,
      hour: targetHour,
      timeSlot: `${targetHour}:00 - ${targetHour + 1}:00`,
      weather,
      suitability,
      location: 'San Fernando, Pampanga',
      isMockData: weather.isMockData || false
    });
  } catch (error) {
    console.error('Error in GET /weather/datetime:', error);
    return res.status(500).json({
      message: 'Internal server error while fetching weather data'
    });
  }
});

/**
 * @route POST /api/weather/refresh/:reservationId
 * @desc Refresh weather forecast for a specific reservation
 * @access Private
 */
router.post('/refresh/:reservationId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reservationId } = req.params;

    if (!reservationId) {
      return res.status(400).json({
        message: 'Reservation ID is required'
      });
    }

    // Find the reservation
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({
        message: 'Reservation not found'
      });
    }

    // Verify user owns the reservation or is admin
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required'
      });
    }

    if (reservation.userId.toString() !== req.user._id.toString() &&
        req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res.status(403).json({
        message: 'You do not have permission to refresh this reservation\'s weather'
      });
    }

    // Check if refresh is needed
    if (!shouldRefreshWeather(reservation)) {
      return res.json({
        message: 'Weather data is still fresh',
        weatherForecast: reservation.weatherForecast
      });
    }

    // Refresh weather
    const updated = await refreshReservationWeather(reservationId);

    return res.json({
      message: 'Weather forecast updated successfully',
      weatherForecast: updated.weatherForecast
    });
  } catch (error) {
    console.error('Error refreshing weather:', error);
    return res.status(500).json({
      message: 'Failed to refresh weather forecast'
    });
  }
});

export default router;