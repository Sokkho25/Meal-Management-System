const asyncHandler = require('../utils/asyncHandler');

/** Wraps every function of a controller object so thrown errors reach the error handler. */
const wrap = (ctrl) => Object.fromEntries(Object.entries(ctrl).map(([k, fn]) => [k, typeof fn === 'function' ? asyncHandler(fn) : fn]));

module.exports = { wrap };
