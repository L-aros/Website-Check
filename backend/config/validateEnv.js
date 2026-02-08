const required = (key) => {
  const v = String(process.env[key] || '').trim();
  return v ? null : key;
};

const validateEnv = () => {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const isProd = nodeEnv === 'production';

  const missing = [];
  if (isProd) {
    for (const k of ['JWT_SECRET', 'ADMIN_PASSWORD', 'DB_NAME', 'DB_USER', 'DB_PASS', 'DB_HOST']) {
      const m = required(k);
      if (m) missing.push(m);
    }
  }

  if (missing.length > 0) {
    const message = `缺少关键环境变量（生产环境必须配置）：${missing.join(', ')}`;
    const err = new Error(message);
    err.code = 'ENV_MISSING';
    throw err;
  }

  return { isProd };
};

module.exports = { validateEnv };

