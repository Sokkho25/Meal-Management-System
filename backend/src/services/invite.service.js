const { Household, Member } = require('../models');

/** Gives a user access to households that invited their email, and links their member records. */
async function resolveInvites(user) {
  const households = await Household.find({ 'invites.email': user.email });
  for (const h of households) {
    const inv = h.invites.find((i) => i.email === user.email);
    if (!h.roleOf(user._id)) h.users.push({ user: user._id, role: inv.role });
    h.invites = h.invites.filter((i) => i.email !== user.email);
    await h.save();
    if (!user.lastHousehold) user.lastHousehold = h._id;
  }
  await Member.updateMany({ email: user.email, user: null, deletedAt: null }, { $set: { user: user._id } });
  if (user.isModified && user.isModified()) await user.save();
}

module.exports = { resolveInvites };
