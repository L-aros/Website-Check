const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/AuthController');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, try again later' },
});

router.post('/login', loginLimiter, authController.login);
router.get('/session', authController.getSession);
router.post('/logout', authController.logout);

module.exports = router;
