const PLACEHOLDER_VALUES = new Set([
  'please_change_me',
  'dev_secret_change_me',
  'changeme',
  'change_me',
  'change-this',
  'replace_me',
]);

const AUTH_COOKIE_NAME = 'auth_token';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const normalizeValue = (value) => String(value || '').trim();

const isPlaceholderValue = (value) => {
  const normalized = normalizeValue(value).toLowerCase();
  return !normalized || PLACEHOLDER_VALUES.has(normalized);
};

const requireConfiguredValue = (key) => {
  const value = normalizeValue(process.env[key]);
  if (isPlaceholderValue(value)) {
    const err = new Error(`${key} must be configured with a non-placeholder value`);
    err.code = 'ENV_MISSING';
    throw err;
  }
  return value;
};

const getJwtSecret = () => requireConfiguredValue('JWT_SECRET');

const isSecureCookie = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const getAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecureCookie(),
  path: '/',
  maxAge: SESSION_TTL_MS,
});

const getAuthClearCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: isSecureCookie(),
  path: '/',
});

module.exports = {
  AUTH_COOKIE_NAME,
  SESSION_TTL_MS,
  getAuthCookieOptions,
  getAuthClearCookieOptions,
  getJwtSecret,
  isPlaceholderValue,
  requireConfiguredValue,
};
