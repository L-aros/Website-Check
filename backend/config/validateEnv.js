const required = (key) => {
  const v = String(process.env[key] || '').trim();
  return v ? null : key;
};

const validateEnv = () => {
  const nodeEnv = String(process.env.NODE_ENV || '').trim().toLowerCase();
  const isProd = nodeEnv === 'production';
  const dialect = String(process.env.DB_DIALECT || 'mysql').trim().toLowerCase();

  const missing = [];
  if (isProd) {
    const base = ['JWT_SECRET', 'ADMIN_PASSWORD'];
    for (const k of base) {
      const m = required(k);
      if (m) missing.push(m);
    }

    const dbKeys =
      dialect === 'sqlite'
        ? ['DB_STORAGE']
        : ['DB_NAME', 'DB_USER', 'DB_PASS', 'DB_HOST'];
    for (const k of dbKeys) {
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

