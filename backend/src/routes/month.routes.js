const router = require('express').Router({ mergeParams: true });
const validate = require('../middleware/validate');
const { loadMonth, requireAdmin, requireOpen } = require('../middleware/access');
const v = require('../utils/validators');
const { wrap } = require('./helpers');
const month = wrap(require('../controllers/month.controller'));
const members = wrap(require('../controllers/member.controller'));
const meals = wrap(require('../controllers/meal.controller'));
const notifications = wrap(require('../controllers/notification.controller'));
const reports = wrap(require('../controllers/report.controller'));
const rec = require('../controllers/records.controller');

const bazar = wrap(rec.bazar);
const expenses = wrap(rec.expenses);
const contributions = wrap(rec.contributions);
const settlements = wrap(rec.settlements);
const guests = wrap(rec.guests);
const shopping = wrap(rec.shopping);
const mealPlans = wrap(rec.mealPlans);

const q = validate(v.listQuery, 'query');
const open = requireOpen;
const admin = requireAdmin;

router.use('/:monthId', loadMonth);

// Workspace
router.get('/:monthId', month.get);
router.patch('/:monthId', admin, open, validate(v.month.update), month.update);
router.get('/:monthId/calculation', month.calculation);
router.get('/:monthId/dashboard', month.dashboard);
router.get('/:monthId/daily/:date', month.daily);
router.get('/:monthId/close-preview', admin, month.closePreview);
router.post('/:monthId/close', admin, month.close);
router.post('/:monthId/reopen', admin, month.reopen);
router.get('/:monthId/trash', admin, month.trash);

// Members
router.get('/:monthId/members', members.list);
router.post('/:monthId/members', admin, open, validate(v.member.create), members.create);
router.patch('/:monthId/members/:id', open, validate(v.member.update), members.update);
router.delete('/:monthId/members/:id', admin, open, members.remove);
router.post('/:monthId/members/:id/restore', admin, open, members.restore);

// Meals
router.get('/:monthId/meals', meals.list);
router.get('/:monthId/meals/day/:date', meals.day);
router.put('/:monthId/meals/day/:date', open, validate(v.meals.day), meals.saveDay);
router.delete('/:monthId/meals/day/:date/:memberId', open, meals.removeEntry);
router.post('/:monthId/meals/quick', open, validate(v.meals.quick), meals.quick);
router.post('/:monthId/meals/copy', open, validate(v.meals.copy), meals.copy);

// Standard record resources
function resource(path, ctrl, schemas, { createAdmin = false } = {}) {
  router.get(`/:monthId/${path}`, q, ctrl.list);
  router.post(`/:monthId/${path}`, ...(createAdmin ? [admin] : []), open, validate(schemas.create), ctrl.create);
  router.patch(`/:monthId/${path}/:id`, open, validate(schemas.update || schemas.create.partial()), ctrl.update);
  router.delete(`/:monthId/${path}/:id`, open, ctrl.remove);
  router.post(`/:monthId/${path}/:id/restore`, admin, open, ctrl.restore);
}

router.post('/:monthId/bazar/bulk', open, validate(v.bazar.bulk), bazar.bulkCreate);
resource('bazar', bazar, v.bazar);
router.get('/:monthId/expenses/recurring', expenses.recurringSuggestions);
resource('expenses', expenses, v.expense, { createAdmin: true });
resource('contributions', contributions, v.contribution);
resource('settlements', settlements, v.settlement, { createAdmin: true });
resource('guests', guests, { create: v.meals.guest });
resource('shopping-list', shopping, v.shopping);
router.post('/:monthId/shopping-list/:id/convert', open, validate(v.shopping.convert), shopping.convert);

// Meal planning (optional)
router.get('/:monthId/meal-plans', mealPlans.list);
router.put('/:monthId/meal-plans', admin, open, validate(v.mealPlan), mealPlans.upsert);

// Reports & notifications
router.get('/:monthId/reports', reports.get);
router.get('/:monthId/reports/export.csv', reports.csv);
router.get('/:monthId/notifications', notifications.list);
router.post('/:monthId/notifications/dismiss', notifications.dismiss);

module.exports = router;
