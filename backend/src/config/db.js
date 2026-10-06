const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.mongoUri) {
  await mongoose.connect(uri, { autoIndex: !env.isProd || process.env.AUTO_INDEX === 'true' });
  return mongoose.connection;
}

module.exports = { connectDB };
