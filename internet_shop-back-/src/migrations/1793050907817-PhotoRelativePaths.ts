import { MigrationInterface, QueryRunner } from 'typeorm';

// Фото зберігаємо відносними шляхами: повний URL збирається з поточного BASE_URL
// під час відповіді, тому зміна домену, порту чи HTTPS не ламає наявні фото.
export class PhotoRelativePaths1793050907817 implements MigrationInterface {
  name = 'PhotoRelativePaths1793050907817';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "product" SET "cover" = regexp_replace("cover", '^https?://[^/]+/', '') WHERE "cover" ~ '^https?://'`,
    );
    await queryRunner.query(
      `UPDATE "photo_entity" SET "url" = regexp_replace("url", '^https?://[^/]+/', '') WHERE "url" ~ '^https?://'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const baseUrl = (process.env.BASE_URL || 'http://localhost:7777/').replace(
      /\/?$/,
      '/',
    );

    await queryRunner.query(
      `UPDATE "product" SET "cover" = $1 || "cover" WHERE "cover" IS NOT NULL AND "cover" !~ '^https?://'`,
      [baseUrl],
    );
    await queryRunner.query(
      `UPDATE "photo_entity" SET "url" = $1 || "url" WHERE "url" !~ '^https?://'`,
      [baseUrl],
    );
  }
}
