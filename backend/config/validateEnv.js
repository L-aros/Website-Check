const { isPlaceholderValue } = require('../utils/security');

const required = (key) => {
  const value = String(process.env[key] || '').trim();
  return isPlaceholderValue(value) ? key : null;
};

const validateEnv = () => {
  const dialect = String(process.env.DB_DIALECT || 'mysql').trim().toLowerCase();

  const missing = [];
  for (const key of ['JWT_SECRET', 'ADMIN_PASSWORD']) {
    const result = required(key);
    if (result) missing.push(result);
  }

  const dbKeys =
    dialect === 'sqlite'
      ? ['DB_STORAGE']
      : ['DB_NAME', 'DB_USER', 'DB_PASS', 'DB_HOST'];

  for (const key of dbKeys) {
    const result = required(key);
    if (result) missing.push(result);
  }

  if (missing.length > 0) {
    const err = new Error(`Missing required environment variables: ${missing.join(', ')}`);
    err.code = 'ENV_MISSING';
    throw err;
  }

  return { isProd: String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production' };
};

module.exports = { validateEnv };
