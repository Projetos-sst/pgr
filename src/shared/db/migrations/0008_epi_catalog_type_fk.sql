-- FR-002a: garante no banco que epi_catalog.type == categories.type via FK composta.
-- Ordem importa: a UNIQUE constraint alvo (categories.id, type) precisa existir ANTES de
-- criar a FK composta que a referencia, senão o Postgres rejeita com
-- "there is no unique constraint matching given keys for referenced table".
ALTER TABLE "categories" ADD CONSTRAINT "uq_categories_id_type" UNIQUE("id","type");
--> statement-breakpoint
ALTER TABLE "epi_catalog" DROP CONSTRAINT "epi_catalog_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD CONSTRAINT "epi_catalog_category_id_type_fk" FOREIGN KEY ("category_id","type") REFERENCES "public"."categories"("id","type") ON DELETE restrict ON UPDATE no action;
