# Правила для агентів

Цей файл читають усі агенти (Claude Code, Codex та інші). `CLAUDE.md` лише імпортує його, тож нові правила пиши сюди.

## Проєкт

- `internet_shop-back-/` — API на NestJS 11 + TypeORM 0.3 + PostgreSQL, порт 7777.
- `internet_shop-front-/` — Next.js 16 (pages router) + React 19 + MUI + Redux, порт 3000.
- Менеджер пакетів в обох проєктах — **npm** (`npm ci`). Не використовуй yarn і не додавай `yarn.lock`.

## Як запустити локально

1. База даних (з кореня репозиторію):
   ```bash
   docker compose up -d db
   ```
   Якщо Docker не запущений, не встановлюй і не запускай його сам: напиши про це в описі PR.
   Контейнер бази один на всі worktree, і ним користуються всі агенти, тож не зупиняй і не видаляй його (`docker compose down`, `stop`, `rm`).
2. `.env` бека не зберігається в git. У своєму worktree скопіюй його з основної копії репозиторію, а якщо його там немає, створи з прикладу:
   ```bash
   main=$(git worktree list --porcelain | head -1 | cut -d' ' -f2)
   cp "$main/internet_shop-back-/.env" internet_shop-back-/.env 2>/dev/null || cp internet_shop-back-/.env.example internet_shop-back-/.env
   ```
3. Бек: `cd internet_shop-back- && npm ci && npm run start:dev` (у фоні). Таблиці створюються самі під час старту. Потім `npm run seed`: це ролі `USER` і `ADMIN` та адмін (телефон `380990000000`, пароль `admin12345`).
4. Фронт: `cd internet_shop-front- && npm ci && npm run dev` (у фоні), сайт на http://localhost:3000.
5. Після перевірки зупини сервери, які запускав саме ти. Не вбивай чужі процеси: `pkill node` зупинить Agent Office і всіх інших агентів. Свій сервер шукай лише серед тих, хто слухає порт (`lsof -nP -iTCP:<порт> -sTCP:LISTEN`), перевір, що він із твого worktree (`lsof -a -d cwd -p <PID>`), і зупини його разом із батьківським `npm` чи `nest --watch` (`ps -o ppid= -p <PID>`).

## Запуск на своїх портах

Агенти працюють одночасно, тож задача каже, на яких портах і з якою базою запускати магазин тобі. Наприклад, для бека 7778, фронта 3001 і бази `Edelweiss_codex`:

1. Створи свою базу, якщо її ще немає (контейнер бази має бути запущений):
   ```bash
   docker compose exec -T db createdb -U postgres Edelweiss_codex 2>/dev/null || true
   ```
2. Бек: `cd internet_shop-back- && PORT=7778 DB_NAME=Edelweiss_codex BASE_URL=http://localhost:7778/ npm run start:dev` (у фоні), а коли він стартує, — `DB_NAME=Edelweiss_codex npm run seed`.
3. Фронт: `cd internet_shop-front- && NEXT_PUBLIC_API_URL=http://localhost:7778 npm run dev -- -p 3001` (у фоні), сайт на http://localhost:3001.

Змінні з командного рядка мають пріоритет над `.env`. Порти й бази інших агентів не займай, а їхні сервери не зупиняй.

## Перед тим як відкрити PR

1. Збери те, що змінював: бек `npm run build`, фронт `npm run build`. Збірка фронта включає лінт і перевірку типів і має пройти без помилок. Лінт бека: `npm run lint:check` (0 помилок і 0 попереджень).
2. Тести бека: `npm test`. Якщо змінюєш логіку бека, додай або онови unit-тести (`*.spec.ts` поруч із кодом).
   Якщо змінюєш `*.entity.ts`, у тому ж PR додай міграцію: локально схему підганяє `synchronize`, а на продакшні (`NODE_ENV=production`) її створюють лише міграції з `src/migrations/`. Генеруй міграцію на окремій порожній базі, а не на спільних базах агентів (з `internet_shop-back-`):
   ```bash
   docker compose exec -T db createdb -U postgres Edelweiss_mig_<твоє ім'я>
   export DB_NAME=Edelweiss_mig_<твоє ім'я>
   npm run migration:run                                   # наявні міграції
   npm run migration:generate -- src/migrations/<Назва>    # нова міграція зі змін у сутностях
   npm run migration:run && npm run migration:generate -- src/migrations/Check --check  # має бути «No changes»
   docker compose exec -T db dropdb -U postgres Edelweiss_mig_<твоє ім'я>
   ```
   CI падає, якщо сутність змінено без міграції.
3. Якщо змінилася поведінка (UI чи API), запусти застосунок і пройди сценарій у браузері через Playwright MCP. Відкривай тільки http://localhost.
4. Одна задача = один невеликий PR. В описі напиши, що змінено, чому і як перевірено (команди й що саме перевірив у браузері). Якщо задача з issue, додай `Closes #N`.
5. Після відкриття PR автоматично запускаються CI та рев'ю. Якщо CI червоний, виправ і запуш у ту саму гілку.

## Не можна

- Комітити в `main` напряму чи робити force-push.
- Комітити `.env`, токени, паролі.
- Вимикати правила лінтера або тести, щоб пройти перевірки.
- Змінювати lock-файли без зміни залежностей; переформатовувати файли, яких задача не стосується.
- Змінювати `tools/conveyor/`, `.codex/` і `opencode.json`: це диспетчер, який керує агентами, і налаштування агентів.
- Ставити чи знімати мітки `needs-human` і `merge-ok`: їх ставлять конвеєр і людина.
- Зупиняти процеси за портом без `-sTCP:LISTEN`: `lsof -ti :<порт> | xargs kill`, `kill $(lsof -ti :<порт>)`. Такий список містить кожен процес, під'єднаний до порту, зокрема сам Agent Office, бо він раз на кілька секунд опитує сервери агентів. Саме так один агент уже вимкнув офіс.

## Відомі особливості

- Паролі користувачів зберігаються як bcrypt-хеші (`internet_shop-back-/src/auth/password.ts`). Не логуй паролі й токени і не вставляй їх у PR.

## Оплата карткою

- Токена Mono в агентів немає. Шукати його чи просити не треба.
- Без токена оплата «Карткою онлайн (Mono)» закінчується повідомленням «не вдалося перейти до оплати». Це очікувано, а не баг. Накладений платіж працює як завжди.
- Логіку оплати перевіряють unit- і e2e-тести з моком mono (`internet_shop-back-/src/payment/**/*.spec.ts`, `internet_shop-back-/test/payment-*.e2e-spec.ts`). Якщо змінюєш оплату, онови їх.
- Токени й ключі не виводити в логи, PR і коментарі.
