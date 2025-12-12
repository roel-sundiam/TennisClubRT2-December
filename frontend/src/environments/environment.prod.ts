export const environment = {
  production: true,
  apiUrl: 'https://tennisclubrt2-december.onrender.com/api',
  apiBaseUrl: 'https://tennisclubrt2-december.onrender.com',
  socketUrl: 'https://tennisclubrt2-december.onrender.com',
  session: {
    checkIntervalMs: 10000,           // Check every 10 seconds
    warningTimeMs: 5 * 60 * 1000,     // Fixed: 5 minutes before expiration
    showCountdown: true
  }
};