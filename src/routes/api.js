'use strict';

const express = require('express');
const { body, query, param, validationResult, matchedData } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { escapeOutput } = require('../sanitize');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: escapeOutput(errors.array().map((e) => e.msg)) });
  }
  return next();
}

function apiRouter(db) {
  const router = express.Router();

  // Все маршруты /api/* доступны только с валидным JWT.
  router.use(requireAuth);

  // GET /api/data — список постов (с пагинацией).
  router.get(
    '/data',
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt(),
    validate,
    (req, res) => {
      const { limit = 20, offset = 0 } = matchedData(req, { locations: ['query'] });
      const posts = db.listPosts(limit, offset);
      res.json(escapeOutput({ user: req.user.username, count: posts.length, posts }));
    },
  );

  // POST /api/posts — создание поста от имени текущего пользователя.
  router.post(
    '/posts',
    body('title').isString().withMessage('title must be a string').trim()
      .isLength({ min: 1, max: 200 }).withMessage('title must be 1-200 characters'),
    body('body').isString().withMessage('body must be a string').trim()
      .isLength({ min: 1, max: 5000 }).withMessage('body must be 1-5000 characters'),
    validate,
    (req, res) => {
      const { title, body: text } = matchedData(req, { locations: ['body'] });
      const id = db.createPost(req.user.id, title, text);
      res.status(201).json(escapeOutput(db.getPost(id)));
    },
  );

  // GET /api/posts/:id — один пост.
  router.get('/posts/:id', param('id').isInt({ min: 1 }).toInt(), validate, (req, res) => {
    const post = db.getPost(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    return res.json(escapeOutput(post));
  });

  return router;
}

module.exports = { apiRouter };
