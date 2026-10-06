const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const v = require('../utils/validators');
const { wrap } = require('./helpers');
const c = wrap(require('../controllers/auth.controller'));

const env = require('../config/env');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 1000 : 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts, please try again in a few minutes' } });

router.post('/register', authLimiter, validate(v.auth.register), c.register);
router.post('/login', authLimiter, validate(v.auth.login), c.login);
router.post('/forgot-password', authLimiter, validate(v.auth.forgot), c.forgotPassword);
router.post('/reset-password', authLimiter, validate(v.auth.reset), c.resetPassword);
router.post('/logout', requireAuth, c.logout);
router.get('/me', requireAuth, c.me);
router.patch('/me', requireAuth, validate(v.auth.profile), c.updateProfile);
router.post('/change-password', requireAuth, authLimiter, validate(v.auth.changePassword), c.changePassword);

module.exports = router;
