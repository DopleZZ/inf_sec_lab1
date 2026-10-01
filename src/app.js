'use strict';

const express = require('express');
const helmet = require('helmet');
const { authRouter } = require('./routes/auth');
const { apiRouter } = require('./routes/api');

function createApp(db) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet()); // безопасные HTTP-заголовки (CSP, nosniff, HSTS и т.д.)
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/auth', authRouter(db));
  app.use('/api', apiRouter(db));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Наружу не отдаём стектрейсы и внутренние сообщения об ошибках.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
