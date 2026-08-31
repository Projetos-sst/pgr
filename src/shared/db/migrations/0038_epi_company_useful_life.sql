ALTER TABLE "epi_catalog" ADD COLUMN "company_id" uuid;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD COLUMN "useful_life_months" integer;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD CONSTRAINT "epi_catalog_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_epi_catalog_company_id" ON "epi_catalog" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD CONSTRAINT "epi_catalog_useful_life_check" CHECK (useful_life_months > 0);