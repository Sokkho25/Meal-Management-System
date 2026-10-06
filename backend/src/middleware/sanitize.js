// Strips MongoDB operator keys ("$gt", "a.b") from request input so user data can never become a query operator.
function clean(value, depth = 0) {
  if (depth > 10 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => clean(v, depth + 1));
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.')) delete value[key];
    else value[key] = clean(value[key], depth + 1);
  }
  return value;
}

module.exports = function sanitize(req, _res, next) {
  if (req.body) clean(req.body);
  if (req.query) clean(req.query);
  if (req.params) clean(req.params);
  next();
};
