require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/meal_management',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Render sets RENDER_EXTERNAL_URL automatically, so the app works there without setting APP_URL.
  appUrl: (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173').replace(/\/$/, ''),
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB) || 3,
  // Per IP. Everyone in a mess often shares one Wi-Fi IP, so keep this generous.
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN) || 1000,
};

// The app's own public address is always an allowed origin (the API serves the web app in production).
if (!env.corsOrigins.includes(env.appUrl)) env.corsOrigins.push(env.appUrl);

env.isProd = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (!env.jwtSecret) {
  if (env.isProd) throw new Error('JWT_SECRET must be set in production');
  env.jwtSecret = 'dev-only-insecure-secret';
}

module.exports = env;
