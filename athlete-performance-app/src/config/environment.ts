// Type definition for environment configuration
interface EnvironmentConfig {
  BACKEND_URL: string;
  APP_ENV: string;
}

// Simple environment configuration
export const ENV_CONFIG: EnvironmentConfig = {
  BACKEND_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080',
  APP_ENV: process.env.EXPO_PUBLIC_APP_ENV || 'development',
};

// Log config for development debugging
if (ENV_CONFIG.APP_ENV !== 'production') {
  console.log('Environment Config:', {
    BACKEND_URL: ENV_CONFIG.BACKEND_URL,
    APP_ENV: ENV_CONFIG.APP_ENV,
  });
}

export default ENV_CONFIG;