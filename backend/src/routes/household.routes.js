const router = require('express').Router();
const validate = require('../middleware/validate');
const { loadHousehold, requireAdmin } = require('../middleware/access');
const v = require('../utils/validators');
const { wrap } = require('./helpers');
const c = wrap(require('../controllers/household.controller'));
const m = wrap(require('../controllers/month.controller'));

router.get('/', c.list);
router.post('/', validate(v.household.create), c.create);

router.use('/:householdId', loadHousehold);
router.get('/:householdId', c.get);
router.patch('/:householdId', requireAdmin, validate(v.household.update), c.update);
router.get('/:householdId/users', c.users);
router.post('/:householdId/users', requireAdmin, validate(v.household.invite), c.invite);
router.patch('/:householdId/users/:userId', requireAdmin, validate(v.household.role), c.setRole);
router.delete('/:householdId/users/:userId', requireAdmin, c.removeUser);
router.delete('/:householdId/invites', requireAdmin, c.cancelInvite);
router.get('/:householdId/categories', c.categories);
router.post('/:householdId/categories', requireAdmin, validate(v.household.category), c.createCategory);
router.patch('/:householdId/categories/:categoryId', requireAdmin, validate(v.household.categoryUpdate), c.updateCategory);
router.get('/:householdId/months', c.months);
router.post('/:householdId/months', requireAdmin, validate(v.month.create), m.create);
router.get('/:householdId/history', c.history);
router.get('/:householdId/audit', requireAdmin, c.audit);

module.exports = router;
