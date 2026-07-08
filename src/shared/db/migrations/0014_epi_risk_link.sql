CREATE TYPE "public"."epi_neutralization" AS ENUM('neutralizes', 'does_not_neutralize', 'not_applicable');--> statement-breakpoint
ALTER TABLE "epi_risk" DROP CONSTRAINT "epi_risk_ges_id_ges_id_fk";--> statement-breakpoint
DROP INDEX "idx_epi_risk_ges_id";--> statement-breakpoint
DROP INDEX "uq_epi_risk_org_catalog_ges";--> statement-breakpoint
ALTER TABLE "epi_risk" ADD COLUMN "risk_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "epi_risk" ADD COLUMN "neutralization" "public"."epi_neutralization" NOT NULL;--> statement-breakpoint
ALTER TABLE "epi_risk" ADD CONSTRAINT "epi_risk_risk_id_risks_id_fk" FOREIGN KEY ("risk_id") REFERENCES "public"."risks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_epi_risk_risk_id" ON "epi_risk" USING btree ("risk_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_epi_risk_org_catalog_risk" ON "epi_risk" USING btree ("org_id","catalog_id","risk_id");--> statement-breakpoint
ALTER TABLE "epi_risk" DROP COLUMN "ges_id";--> statement-breakpoint
ALTER TABLE "epi_risk" DROP COLUMN "neutralizes";
