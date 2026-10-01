'use strict';

const Database = require('better-sqlite3');

function openDb(file) {
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT    NOT NULL,
      body       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Все запросы — только prepared statements с плейсхолдерами (?),
  // пользовательские данные никогда не конкатенируются в SQL (защита от SQLi).
  const stmts = {
    findUserByUsername: db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?'),
    insertUser: db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)'),
    listPosts: db.prepare(`
      SELECT p.id, p.title, p.body, p.created_at, u.username AS author
      FROM posts p JOIN users u ON u.id = p.author_id
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `),
    insertPost: db.prepare('INSERT INTO posts (author_id, title, body) VALUES (?, ?, ?)'),
    getPost: db.prepare(`
      SELECT p.id, p.title, p.body, p.created_at, u.username AS author
      FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.id = ?
    `),
  };

  return {
    raw: db,
    findUserByUsername: (username) => stmts.findUserByUsername.get(username),
    createUser: (username, passwordHash) => stmts.insertUser.run(username, passwordHash).lastInsertRowid,
    listPosts: (limit, offset) => stmts.listPosts.all(limit, offset),
    createPost: (authorId, title, body) => stmts.insertPost.run(authorId, title, body).lastInsertRowid,
    getPost: (id) => stmts.getPost.get(id),
    close: () => db.close(),
  };
}

module.exports = { openDb };
