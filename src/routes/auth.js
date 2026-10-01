'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const config = require('../config');

// Хэш-заглушка: сравниваем с ним, если пользователь не найден, чтобы время ответа
// не выдавало, существует ли логин (защита от перебора/энумерации пользователей).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', config.bcryptRounds);

function authRouter(db) {
  const router = express.Router();

  // Ограничение попыток входа — защита от brute force.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many login attempts, try again later' },
  });

  router.post(
    '/login',
    loginLimiter,
    body('username').isString().trim().isLength({ min: 3, max: 32 }),
    body('password').isString().isLength({ min: 1, max: 128 }),
    async (req, res) => {
      if (!validationResult(req).isEmpty()) {
        return res.status(400).json({ error: 'username and password are required' });
      }

      const { username, password } = req.body;
      const user = db.findUserByUsername(username);
      const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

      if (!user || !ok) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }

      const token = jwt.sign({ username: user.username }, config.jwt.secret, {
        algorithm: config.jwt.algorithm,
        expiresIn: config.jwt.expiresIn,
        issuer: config.jwt.issuer,
        subject: String(user.id),
      });

      return res.json({ token, tokenType: 'Bearer', expiresIn: config.jwt.expiresIn });
    },
  );

  return router;
}

module.exports = { authRouter };
