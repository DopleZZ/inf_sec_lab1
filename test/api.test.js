'use strict';

process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

let db;
let app;
let token;

before(async () => {
  db = openDb(':memory:');
  db.createUser('alice', await bcrypt.hash('Correct-Horse-1', 4));
  app = createApp(db);
});

after(() => db.close());

test('passwords are stored as bcrypt hashes, not plaintext', () => {
  const user = db.findUserByUsername('alice');
  assert.notEqual(user.password_hash, 'Correct-Horse-1');
  assert.match(user.password_hash, /^\$2[aby]\$/);
});

test('login with wrong password returns 401', async () => {
  const res = await request(app).post('/auth/login').send({ username: 'alice', password: 'wrong' });
  assert.equal(res.status, 401);
  assert.equal(res.body.token, undefined);
});

test('login with unknown user returns the same 401', async () => {
  const res = await request(app).post('/auth/login').send({ username: 'nobody', password: 'x' });
  assert.equal(res.status, 401);
  assert.equal(res.body.error, 'Invalid username or password');
});

test('login with invalid body returns 400', async () => {
  const res = await request(app).post('/auth/login').send({ username: { $ne: null } });
  assert.equal(res.status, 400);
});

test('SQL injection in username does not bypass auth', async () => {
  const res = await request(app).post('/auth/login').send({ username: "alice' OR '1'='1", password: "' OR '1'='1" });
  assert.equal(res.status, 401);
});

test('login with valid credentials returns JWT', async () => {
  const res = await request(app).post('/auth/login').send({ username: 'alice', password: 'Correct-Horse-1' });
  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  token = res.body.token;
});

test('GET /api/data without token returns 401', async () => {
  const res = await request(app).get('/api/data');
  assert.equal(res.status, 401);
});

test('GET /api/data with forged token returns 401', async () => {
  const forged = jwt.sign({ sub: '1', username: 'alice' }, 'attacker-secret', { issuer: 'secure-rest-api' });
  const res = await request(app).get('/api/data').set('Authorization', `Bearer ${forged}`);
  assert.equal(res.status, 401);
});

test('GET /api/data with "alg: none" token returns 401', async () => {
  const none = jwt.sign({ sub: '1', username: 'alice' }, null, { algorithm: 'none', issuer: 'secure-rest-api' });
  const res = await request(app).get('/api/data').set('Authorization', `Bearer ${none}`);
  assert.equal(res.status, 401);
});

test('POST /api/posts escapes HTML to prevent XSS', async () => {
  const res = await request(app)
    .post('/api/posts')
    .set('Authorization', `Bearer ${token}`)
    .send({ title: '<script>alert(1)</script>', body: '<img src=x onerror="alert(1)">' });
  assert.equal(res.status, 201);
  assert.equal(res.body.title, '&lt;script&gt;alert(1)&lt;&#x2F;script&gt;');
  assert.ok(!res.body.body.includes('<'));
});

test('GET /api/data with valid token returns escaped posts', async () => {
  const res = await request(app).get('/api/data').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.user, 'alice');
  assert.equal(res.body.count, 1);
  assert.ok(!JSON.stringify(res.body).includes('<script>'));
});

test('POST /api/posts validates input', async () => {
  const res = await request(app).post('/api/posts').set('Authorization', `Bearer ${token}`).send({ title: '' });
  assert.equal(res.status, 400);
});

test('GET /api/posts/:id rejects non-numeric id', async () => {
  const res = await request(app).get('/api/posts/1%20OR%201=1').set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 400);
});
