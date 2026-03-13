const jwt = require('jsonwebtoken');
const {
  AUTH_COOKIE_NAME,
  getAuthClearCookieOptions,
  getAuthCookieOptions,
  getJwtSecret,
  requireConfiguredValue,
} = require('../utils/security');

const buildSessionPayload = (user) => ({
  authenticated: true,
  user: { role: user && user.role ? user.role : 'admin' },
});

const getAuthToken = (req) => {
  if (!req || !req.cookies) return '';
  return String(req.cookies[AUTH_COOKIE_NAME] || '').trim();
};

const clearAuthCookie = (res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getAuthClearCookieOptions());
};

exports.login = (req, res) => {
  const password = String((req.body && req.body.password) || '');
  const adminPassword = requireConfiguredValue('ADMIN_PASSWORD');

  if (password !== adminPassword) {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ role: 'admin' }, getJwtSecret(), { expiresIn: '7d' });
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return res.json(buildSessionPayload({ role: 'admin' }));
};

exports.getSession = (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    return res.json({ authenticated: false, user: null });
  }

  try {
    const user = jwt.verify(token, getJwtSecret());
    return res.json(buildSessionPayload(user));
  } catch {
    clearAuthCookie(res);
    return res.json({ authenticated: false, user: null });
  }
};

exports.logout = (_req, res) => {
  clearAuthCookie(res);
  res.json({ authenticated: false, user: null });
};

exports.verifyToken = (req, res, next) => {
  const token = getAuthToken(req);

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    return next();
  });
};

exports.AUTH_COOKIE_NAME = AUTH_COOKIE_NAME;
exports.clearAuthCookie = clearAuthCookie;
