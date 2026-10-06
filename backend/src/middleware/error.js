const env = require('../config/env');

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'A record with these details already exists';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request is too large';
  } else if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File is too large';
  }
  if (status >= 500 && !env.isTest) console.error(err);
  res.status(status).json({ message: status >= 500 && env.isProd ? 'Internal server error' : message, details: err.details });
}

module.exports = { notFound, errorHandler };
