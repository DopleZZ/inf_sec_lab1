'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

// Проверяет заголовок "Authorization: Bearer <jwt>" на защищённых эндпоинтах.
function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Алгоритм зафиксирован явно — защищает от атак с "alg: none" и подменой алгоритма.
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: [config.jwt.algorithm],
      issuer: config.jwt.issuer,
    });
    req.user = { id: Number(payload.sub), username: payload.username };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth };
