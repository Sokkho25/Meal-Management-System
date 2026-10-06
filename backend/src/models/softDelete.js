// Adds soft-delete fields. Financial records are never removed from the database by normal API calls.
module.exports = function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: require('mongoose').Schema.Types.ObjectId, ref: 'User', default: null },
  });
};
