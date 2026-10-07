const env = require('../config/env');
const { User } = require('../models');

// The first account is fixed once created, so it is safe to remember it.
let firstUserId = null;

/** Site owner: listed in OWNER_EMAILS, or (when that is empty) the first account ever registered. */
async function isOwner(user) {
  if (!user) return false;
  if (env.ownerEmails.length) return env.ownerEmails.includes(String(user.email).toLowerCase());
  if (!firstUserId) {
    const first = await User.findOne({}, { _id: 1 }).sort({ createdAt: 1, _id: 1 }).lean();
    if (!first) return false;
    firstUserId = String(first._id);
  }
  return firstUserId === String(user._id);
}

// Tests reset the database between runs.
const resetOwnerCache = () => {
  firstUserId = null;
};

module.exports = { isOwner, resetOwnerCache };
