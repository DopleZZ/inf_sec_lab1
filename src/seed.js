'use strict';

// Создаёт демо-пользователей и посты. Пароли задаются через переменные окружения
// и сохраняются только в виде bcrypt-хэша.
const bcrypt = require('bcryptjs');
const config = require('./config');
const { openDb } = require('./db');

const users = [
  { username: 'alice', password: process.env.SEED_ALICE_PASSWORD },
  { username: 'bob', password: process.env.SEED_BOB_PASSWORD },
];

if (users.some((u) => !u.password)) {
  console.error('Set SEED_ALICE_PASSWORD and SEED_BOB_PASSWORD (see .env.example)');
  process.exit(1);
}

const db = openDb(config.dbFile);

for (const { username, password } of users) {
  if (db.findUserByUsername(username)) {
    console.log(`user ${username} already exists, skipping`);
    continue;
  }
  const id = db.createUser(username, bcrypt.hashSync(password, config.bcryptRounds));
  db.createPost(id, `Hello from ${username}`, `First post by ${username}.`);
  console.log(`created user ${username}`);
}

db.close();
