import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1792788161169 implements MigrationInterface {
  name = 'Init1792788161169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "photo_entity" ("id" SERIAL NOT NULL, "url" character varying NOT NULL, "productId" integer, CONSTRAINT "PK_e3a5807b27c3b7e1f36c9e65fac" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_gender_enum" AS ENUM('man', 'woman', 'unisex')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_category_enum" AS ENUM('outerwear', 'pants', 'tshirts', 'shirts', 'hoodies', 'dresses', 'skirts', 'shoes', 'accessories', 'sportswear', 'underwear')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_season_enum" AS ENUM('all-season', 'spring-summer', 'autumn-winter')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."product_status_enum" AS ENUM('active', 'hidden', 'out-of-stock')`,
    );
    await queryRunner.query(
      `CREATE TABLE "product" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "cover" character varying, "count" integer, "description" character varying NOT NULL, "sizes" text array NOT NULL DEFAULT '{}', "weight" character varying, "colors" text array DEFAULT '{}', "material" character varying, "price" integer NOT NULL, "salePrice" integer, "gender" "public"."product_gender_enum", "category" "public"."product_category_enum", "subcategory" character varying, "brand" character varying, "season" "public"."product_season_enum" NOT NULL DEFAULT 'all-season', "status" "public"."product_status_enum" NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "order_item" ("id" SERIAL NOT NULL, "productId" integer NOT NULL, "size" character varying NOT NULL, "quantity" integer NOT NULL, "price" integer NOT NULL, "orderId" integer, CONSTRAINT "PK_d01158fe15b1ead5c26fd7f4e90" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_paymentmethod_enum" AS ENUM('COD', 'CARD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_paymentstatus_enum" AS ENUM('NOT_REQUIRED', 'PENDING', 'PAID', 'FAILED', 'REFUNDED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."order_deliverymethod_enum" AS ENUM('NOVA_POSHTA', 'UKRPOSHTA', 'MEEST')`,
    );
    await queryRunner.query(
      `CREATE TABLE "order" ("id" SERIAL NOT NULL, "total" integer NOT NULL DEFAULT '0', "status" character varying NOT NULL, "paymentMethod" "public"."order_paymentmethod_enum" NOT NULL DEFAULT 'COD', "paymentStatus" "public"."order_paymentstatus_enum" NOT NULL DEFAULT 'NOT_REQUIRED', "paymentInvoiceId" character varying, "paidAt" TIMESTAMP WITH TIME ZONE, "comment" character varying, "deliveryMethod" "public"."order_deliverymethod_enum" NOT NULL DEFAULT 'NOVA_POSHTA', "cityName" character varying NOT NULL, "department" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" integer, CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "value" character varying NOT NULL, "description" character varying NOT NULL, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "basket_items" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "productId" integer NOT NULL, "size" character varying NOT NULL, "quantity" integer NOT NULL DEFAULT '1', CONSTRAINT "PK_9c916f29c8b703688fd4b1717c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "fullName" character varying NOT NULL, "email" character varying, "phoneNumber" character varying NOT NULL, "password" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updateAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_1e3d0240b49c40521aaeb953293" UNIQUE ("phoneNumber"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "quick_order" ("id" SERIAL NOT NULL, "phoneNumber" character varying NOT NULL, "size" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "productId" integer, CONSTRAINT "PK_ba0919edfa2214d538415acb864" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens" ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE TABLE "payment" ("id" SERIAL NOT NULL, "orderId" integer NOT NULL, "provider" character varying NOT NULL, "invoiceId" character varying NOT NULL, "kind" character varying NOT NULL DEFAULT 'invoice', "amount" integer NOT NULL, "status" character varying NOT NULL, "providerModifiedAt" TIMESTAMP WITH TIME ZONE, "rawPayload" jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fcaec7df5adf9cac408c686b2ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users_roles_roles" ("usersId" integer NOT NULL, "rolesId" integer NOT NULL, CONSTRAINT "PK_6c1a055682c229f5a865f2080c1" PRIMARY KEY ("usersId", "rolesId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df951a64f09865171d2d7a502b" ON "users_roles_roles" ("usersId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2f0366aa9349789527e0c36d9" ON "users_roles_roles" ("rolesId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "photo_entity" ADD CONSTRAINT "FK_0f5140f82d3232be1a757e785d9" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" ADD CONSTRAINT "FK_904370c093ceea4369659a3c810" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_caabe91507b3379c7ba73637b84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "basket_items" ADD CONSTRAINT "FK_2945698449c10cabf02d858cf7a" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "basket_items" ADD CONSTRAINT "FK_bca53dec99316713d968c6a2141" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "quick_order" ADD CONSTRAINT "FK_c3f218ecf340af4b86746cf8f15" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles_roles" ADD CONSTRAINT "FK_df951a64f09865171d2d7a502b1" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles_roles" ADD CONSTRAINT "FK_b2f0366aa9349789527e0c36d97" FOREIGN KEY ("rolesId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users_roles_roles" DROP CONSTRAINT "FK_b2f0366aa9349789527e0c36d97"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users_roles_roles" DROP CONSTRAINT "FK_df951a64f09865171d2d7a502b1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "quick_order" DROP CONSTRAINT "FK_c3f218ecf340af4b86746cf8f15"`,
    );
    await queryRunner.query(
      `ALTER TABLE "basket_items" DROP CONSTRAINT "FK_bca53dec99316713d968c6a2141"`,
    );
    await queryRunner.query(
      `ALTER TABLE "basket_items" DROP CONSTRAINT "FK_2945698449c10cabf02d858cf7a"`,
    );
    await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_caabe91507b3379c7ba73637b84"`);
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_904370c093ceea4369659a3c810"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_item" DROP CONSTRAINT "FK_646bf9ece6f45dbe41c203e06e0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "photo_entity" DROP CONSTRAINT "FK_0f5140f82d3232be1a757e785d9"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_b2f0366aa9349789527e0c36d9"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_df951a64f09865171d2d7a502b"`);
    await queryRunner.query(`DROP TABLE "users_roles_roles"`);
    await queryRunner.query(`DROP TABLE "payment"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_c25bc63d248ca90e8dcc1d92d0"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "quick_order"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "basket_items"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "order"`);
    await queryRunner.query(`DROP TYPE "public"."order_deliverymethod_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_paymentstatus_enum"`);
    await queryRunner.query(`DROP TYPE "public"."order_paymentmethod_enum"`);
    await queryRunner.query(`DROP TABLE "order_item"`);
    await queryRunner.query(`DROP TABLE "product"`);
    await queryRunner.query(`DROP TYPE "public"."product_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."product_season_enum"`);
    await queryRunner.query(`DROP TYPE "public"."product_category_enum"`);
    await queryRunner.query(`DROP TYPE "public"."product_gender_enum"`);
    await queryRunner.query(`DROP TABLE "photo_entity"`);
  }
}
