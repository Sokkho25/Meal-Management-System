const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../middleware/auth');
const { resolveInvites } = require('../services/invite.service');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

exports.register = async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, phone, passwordHash: await bcrypt.hash(password, 12) });
  await resolveInvites(user);
  res.status(201).json({ token: signToken(user), user });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  // Same message for unknown email and wrong password.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw ApiError.unauthorized('Incorrect email or password');
  await resolveInvites(user);
  res.json({ token: signToken(user), user });
};

// JWTs are stateless; the client discards its token. Kept for API symmetry.
exports.logout = async (_req, res) => res.status(204).end();

exports.me = async (req, res) => res.json({ user: req.user });

exports.updateProfile = async (req, res) => {
  const { name, phone, avatarUrl, notificationPrefs } = req.body;
  if (name !== undefined) req.user.name = name;
  if (phone !== undefined) req.user.phone = phone;
  if (avatarUrl !== undefined) req.user.avatarUrl = avatarUrl;
  if (notificationPrefs) Object.assign(req.user.notificationPrefs, notificationPrefs);
  await req.user.save();
  res.json({ user: req.user });
};

exports.changePassword = async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw ApiError.badRequest('Current password is incorrect');
  user.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  res.json({ token: signToken(user), message: 'Password changed' });
};

exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  const response = { message: 'If that email is registered, a reset link has been sent.' };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    const url = `${env.appUrl}/reset-password?token=${token}`;
    // Hook an email provider (SES, Resend, SMTP...) here. Until then the link goes to the server log,
    // which only the hosting account owner can read, and is returned to the browser in development.
    if (!env.isTest) console.log(`[password reset] ${user.email}: ${url}`);
    if (!env.isProd) response.devResetUrl = url;
  }
  res.json(response);
};

exports.resetPassword = async (req, res) => {
  const user = await User.findOne({ passwordResetTokenHash: hashToken(req.body.token), passwordResetExpires: { $gt: new Date() } }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.passwordChangedAt = new Date();
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  res.json({ token: signToken(user), user });
};
