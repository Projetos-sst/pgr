ALTER TABLE "training_catalog" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "training_catalog" t SET "number" = sub.rn FROM (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY created_at, id) AS rn
  FROM "training_catalog"
) sub WHERE t.id = sub.id;--> statement-breakpoint
ALTER TABLE "training_catalog" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "training_catalog" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_training_catalog_org_number" ON "training_catalog" USING btree ("org_id","number");
