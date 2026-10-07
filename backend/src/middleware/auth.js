const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const signToken = (user) => jwt.sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account not found');
  // Tokens issued before a password change are no longer valid.
  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized('Password was changed, please log in again');
  }
  req.user = user;
  // Record activity for the owner page, at most every 5 minutes per user.
  const now = Date.now();
  if (!user.lastSeenAt || now - user.lastSeenAt.getTime() > 5 * 60 * 1000) {
    user.lastSeenAt = new Date(now);
    User.updateOne({ _id: user._id }, { $set: { lastSeenAt: user.lastSeenAt } }).catch(() => {});
  }
  next();
});

module.exports = { requireAuth, signToken };
