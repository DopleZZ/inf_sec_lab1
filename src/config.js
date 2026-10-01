'use strict';

const secret = process.env.JWT_SECRET;

// Без надёжного секрета подписи JWT запускаться нельзя: слабый/дефолтный
// секрет позволяет подделывать токены (Broken Authentication).
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be set and be at least 32 characters long');
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dbFile: process.env.DB_FILE || 'data.db',
  jwt: {
    secret,
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'secure-rest-api',
  },
  bcryptRounds: 12,
};
