const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const sanitize = require('./middleware/sanitize');
const { UPLOAD_DIR } = require('./controllers/upload.controller');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin/non-browser requests and configured origins (incl. Capacitor's capacitor://localhost).
      if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes('*')) return cb(null, true);
      return cb(Object.assign(new Error('Not allowed by CORS'), { status: 403 }));
    },
    credentials: false,
  })
);
app.use(compression());
app.use(express.json({ limit: '200kb' }));
app.use(sanitize);
if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: env.isTest ? 100000 : env.rateLimitPerMin, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', fallthrough: false }));
app.use('/api', routes);

// Optionally serve the built frontend from the same origin.
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (env.isProd && fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
