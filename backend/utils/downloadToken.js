const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('./security');

const getSecret = () => `${getJwtSecret()}::download`;

const signDownloadToken = ({ path, name }, ttlSeconds = 300) => {
  const p = String(path || '').trim();
  const n = String(name || '').trim();
  if (!p) return '';
  const payload = { p, n };
  return jwt.sign(payload, getSecret(), {
    expiresIn: ttlSeconds,
    audience: 'download',
  });
};

const verifyDownloadToken = (token) => {
  const t = String(token || '').trim();
  if (!t) return null;
  try {
    const payload = jwt.verify(t, getSecret(), { audience: 'download' });
    return payload || null;
  } catch {
    return null;
  }
};

module.exports = { signDownloadToken, verifyDownloadToken };
