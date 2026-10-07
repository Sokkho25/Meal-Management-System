const router = require('express').Router();
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { isOwner } = require('../services/owner.service');
const { wrap } = require('./helpers');
const c = wrap(require('../controllers/owner.controller'));

// Site owner only (see OWNER_EMAILS). Household admins are not site owners.
router.use(
  asyncHandler(async (req, _res, next) => {
    if (!(await isOwner(req.user))) throw ApiError.forbidden('Only the site owner can open this page');
    next();
  })
);
router.get('/stats', c.stats);
router.get('/users', c.users);
router.get('/households', c.households);

module.exports = router;
