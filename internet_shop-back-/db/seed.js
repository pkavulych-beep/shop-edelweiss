// Seeds the reference data the app can't work without: the USER and ADMIN roles
// (registration fails without USER) and a first admin account.
//
// The tables are created by TypeORM (`synchronize: true`) when the API starts, so start
// the API first; this script waits up to a minute for them. Safe to run repeatedly.
//
// Usage: npm run seed
require('dotenv/config');
const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const ROLES = [
  { value: 'USER', description: 'Покупець' },
  { value: 'ADMIN', description: 'Адміністратор' },
];

// The password is stored as a bcrypt hash, the same way UsersService.create stores it.
const ADMIN = {
  fullName: process.env.SEED_ADMIN_NAME || 'Адміністратор',
  phoneNumber: process.env.SEED_ADMIN_PHONE || '380990000000',
  password: process.env.SEED_ADMIN_PASSWORD || 'admin12345',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@example.com',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForSchema(client) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { rows } = await client.query(
      `SELECT to_regclass('public.roles') AS roles,
              to_regclass('public.users') AS users,
              to_regclass('public.users_roles_roles') AS links`,
    );
    if (rows[0].roles && rows[0].users && rows[0].links) return;
    await sleep(1000);
  }
  throw new Error(
    'Tables not found after 60s. Start the API first (npm run start:dev) so TypeORM creates them.',
  );
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();

  try {
    await waitForSchema(client);

    const roleIds = {};
    for (const role of ROLES) {
      let { rows } = await client.query('SELECT id FROM roles WHERE value = $1', [role.value]);
      if (!rows.length) {
        ({ rows } = await client.query(
          'INSERT INTO roles (value, description) VALUES ($1, $2) RETURNING id',
          [role.value, role.description],
        ));
        console.log(`Created role ${role.value}`);
      }
      roleIds[role.value] = rows[0].id;
    }

    let { rows } = await client.query('SELECT id FROM users WHERE "phoneNumber" = $1', [
      ADMIN.phoneNumber,
    ]);
    if (!rows.length) {
      ({ rows } = await client.query(
        `INSERT INTO users ("fullName", email, "phoneNumber", password)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [ADMIN.fullName, ADMIN.email, ADMIN.phoneNumber, await bcrypt.hash(ADMIN.password, 10)],
      ));
      console.log(`Created admin ${ADMIN.phoneNumber}`);
    }
    const adminId = rows[0].id;

    for (const value of ['USER', 'ADMIN']) {
      await client.query(
        `INSERT INTO users_roles_roles ("usersId", "rolesId")
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM users_roles_roles WHERE "usersId" = $1 AND "rolesId" = $2
         )`,
        [adminId, roleIds[value]],
      );
    }

    console.log(`Seed done. Admin login: phone ${ADMIN.phoneNumber}, password ${ADMIN.password}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
