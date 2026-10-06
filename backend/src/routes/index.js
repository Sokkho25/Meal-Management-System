const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { wrap } = require('./helpers');
const upload = wrap(require('../controllers/upload.controller'));

router.get('/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
router.use('/auth', require('./auth.routes'));
router.use('/households', requireAuth, require('./household.routes'));
router.use('/months', requireAuth, require('./month.routes'));
router.post('/uploads', requireAuth, require('../controllers/upload.controller').middleware, upload.handle);

module.exports = router;
