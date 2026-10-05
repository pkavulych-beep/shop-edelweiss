# Edelweiss — інтернет-магазин

| Папка | Що це | Порт |
|---|---|---|
| `internet_shop-back-/` | API: NestJS 8, TypeORM 0.3, PostgreSQL | 7777 |
| `internet_shop-front-/` | Сайт: Next.js 12, MUI, Redux | 3000 |

## Вимоги

- Node.js 22 і npm (yarn у проєкті не використовується)
- Docker Desktop: у ньому працює локальна база PostgreSQL

## Запуск локально

1. База даних (з кореня репозиторію):
   ```bash
   docker compose up -d db
   ```
2. API:
   ```bash
   cd internet_shop-back-
   cp .env.example .env
   npm ci
   npm run start:dev
   ```
   Під час старту TypeORM сам створює таблиці.
3. Ролі й перший адміністратор (в іншому терміналі, коли API вже запущений):
   ```bash
   cd internet_shop-back-
   npm run seed
   ```
   Адмін за замовчуванням: телефон `380990000000`, пароль `admin12345`. Змінити їх можна через `SEED_ADMIN_PHONE` і `SEED_ADMIN_PASSWORD`. Скрипт можна запускати повторно.
4. Сайт:
   ```bash
   cd internet_shop-front-
   cp .env.example .env.local
   npm ci
   npm run dev
   ```
   Відкрий http://localhost:3000.

## Змінні оточення

API (`internet_shop-back-/.env`, приклад у `.env.example`):

| Змінна | Що це |
|---|---|
| `PORT` | Порт API (7777) |
| `BASE_URL` | Публічна адреса API зі слешем у кінці; з неї будуються посилання на завантажені фото |
| `UPLOADS_DIR` | Каталог для завантажених фото товарів (необов'язково). За замовчуванням `internet_shop-back-/uploads`, він у `.gitignore`. Має бути поза `dist`, бо `dist` видаляється при кожній збірці. На сервері вкажи постійне сховище й додай його в бекапи |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Підключення до PostgreSQL |
| `JWT_SECRET` | Секрет для токенів входу. На продакшені це довгий випадковий рядок |
| `SEED_ADMIN_PHONE`, `SEED_ADMIN_PASSWORD` | Адмін, якого створює `npm run seed` |

Сайт (`internet_shop-front-/.env.local`):

| Змінна | Що це |
|---|---|
| `NEXT_PUBLIC_API_URL` | Адреса API (за замовчуванням `http://localhost:7777`) |

## Автоматичні перевірки

На кожен pull request GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) запускає:

- **Backend:** `npm ci`, збірку, unit-тести і smoke-тест: API стартує з PostgreSQL, створює таблиці, seed проходить, адмін логіниться і отримує свій профіль.
- **Frontend:** `npm ci` і `npm run build`, яка включає лінт і перевірку типів.

## Робота з агентами

Правила для агентів (як запускати проєкт, що перевірити перед PR, чого робити не можна) описані в [`AGENTS.md`](AGENTS.md). Дозволи для Claude Code, щоб агенти не зупинялися на кожній команді, лежать у [`.claude/settings.json`](.claude/settings.json).
