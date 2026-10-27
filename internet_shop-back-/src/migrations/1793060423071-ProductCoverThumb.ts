import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductCoverThumb1793060423071 implements MigrationInterface {
  name = 'ProductCoverThumb1793060423071';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD "coverThumb" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "coverThumb"`);
  }
}
