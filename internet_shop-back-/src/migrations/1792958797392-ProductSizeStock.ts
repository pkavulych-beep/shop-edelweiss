import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductSizeStock1792958797392 implements MigrationInterface {
  name = 'ProductSizeStock1792958797392';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD "sizeStock" json`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "sizeStock"`);
  }
}
