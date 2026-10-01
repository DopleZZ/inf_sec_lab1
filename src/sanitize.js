'use strict';

const validator = require('validator');

// Экранирует HTML-спецсимволы (& < > " ' / `) во всех строковых полях ответа,
// чтобы данные пользователя не могли выполниться как разметка/скрипт (защита от XSS).
function escapeOutput(value) {
  if (typeof value === 'string') return validator.escape(value);
  if (Array.isArray(value)) return value.map(escapeOutput);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, escapeOutput(v)]));
  }
  return value;
}

module.exports = { escapeOutput };
