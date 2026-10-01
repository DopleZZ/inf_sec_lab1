# Secure REST API — лабораторная работа №1

Защищённое REST API на **Node.js + Express 5 + SQLite (better-sqlite3)** с JWT-аутентификацией
и CI/CD-пайплайном GitHub Actions, который запускает SAST и SCA при каждом push и pull request.

## Эндпоинты

| Метод | Путь | Доступ | Описание |
|---|---|---|---|
| `POST` | `/auth/login` | публичный | Принимает `{username, password}` и возвращает JWT |
| `GET` | `/api/data` | JWT | Список постов (`?limit=1..100&offset=0`) |
| `POST` | `/api/posts` | JWT | Создать пост `{title, body}` от имени текущего пользователя |
| `GET` | `/api/posts/:id` | JWT | Получить пост по id |
| `GET` | `/health` | публичный | Проверка работоспособности |

## Меры защиты

| Угроза (OWASP Top 10) | Как закрыта | Где |
|---|---|---|
| **A03 Injection (SQLi)** | Только prepared statements с плейсхолдерами `?`, без конкатенации строк; валидация типов входных данных (express-validator) | `src/db.js`, `src/routes/*.js` |
| **A03 Injection (XSS)** | Все строки в ответах экранируются через `validator.escape()`; `helmet` выставляет CSP и `X-Content-Type-Options: nosniff` | `src/sanitize.js`, `src/app.js` |
| **A07 Broken Authentication** | JWT (HS256, `exp`, `iss`), алгоритм зафиксирован при проверке (защита от `alg: none`); middleware `requireAuth` на всех `/api/*` | `src/middleware/auth.js` |
| Хранение паролей | bcrypt, cost 12; пароли в открытом виде нигде не хранятся | `src/routes/auth.js`, `src/seed.js` |
| Brute force / перебор логинов | Rate limit на `/auth/login` (10 попыток за 15 мин); одинаковый ответ и время ответа для неверного логина и неверного пароля | `src/routes/auth.js` |
| A05 Security Misconfiguration | `helmet`, отключён `X-Powered-By`, лимит тела запроса 10 КБ, наружу не отдаются стектрейсы; без `JWT_SECRET` длиной от 32 символов сервер не запускается | `src/app.js`, `src/config.js` |

## Запуск

```bash
npm ci
cp .env.example .env
# вписать в .env JWT_SECRET (команда для генерации есть в файле) и пароли демо-пользователей
node --env-file=.env src/seed.js   # создаёт пользователей alice и bob
npm run dev                        # http://localhost:3000
```

Тесты и линтер:

```bash
npm test        # 13 тестов: аутентификация, отказ без токена, поддельный токен, alg:none, SQLi, XSS
npm run lint    # ESLint + eslint-plugin-security
npm run audit   # npm audit --audit-level=high
```

## Проверка через curl

```bash
# 1. Без токена — 401
curl -i http://localhost:3000/api/data

# 2. Неверный пароль — 401
curl -i -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"wrong"}' http://localhost:3000/auth/login

# 3. Логин — получаем токен
TOKEN=$(curl -s -H 'Content-Type: application/json' \
  -d '{"username":"alice","password":"<SEED_ALICE_PASSWORD>"}' \
  http://localhost:3000/auth/login | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 4. С токеном — 200
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/data

# 5. XSS-нагрузка возвращается экранированной: "&lt;script&gt;..."
curl -i -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"<script>alert(1)</script>","body":"test"}' http://localhost:3000/api/posts
```

## CI/CD (`.github/workflows/ci.yml`)

Запускается на каждый `push`, `pull_request` и вручную (`workflow_dispatch`).

| Job | Что делает |
|---|---|
| **Lint & tests** | `npm ci`, ESLint, `node --test` |
| **SAST** | ESLint + `eslint-plugin-security`, **Semgrep** (`p/javascript`, `p/expressjs`, `p/jwt`, `p/secrets`), **npm audit** (падает на high/critical) |
| **SCA** | **OWASP Dependency-Check** (падает при CVSS ≥ 7) с отчётами HTML/JSON/SARIF; если задан секрет `SNYK_TOKEN`, дополнительно запускается **Snyk** |

Сводка по каждому сканеру выводится в Summary запуска (вкладка Actions → нужный run), а полные
отчёты сохраняются в артефактах `sast-reports` и `sca-reports`. Отчёт Dependency-Check —
`dependency-check-report.html`.

### Секреты репозитория (Settings → Secrets and variables → Actions)

- `NVD_API_KEY` — **обязателен** для Dependency-Check (начиная с версии 13 без ключа база NVD не загружается).
  Бесплатный ключ: https://nvd.nist.gov/developers/request-an-api-key
- `SNYK_TOKEN` — необязательно, включает шаг Snyk.
