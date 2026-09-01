ALTER TYPE "public"."accident_severity" ADD VALUE 'no_injury' BEFORE 'minor';--> statement-breakpoint
ALTER TABLE "accidents" ADD COLUMN "number" integer;--> statement-breakpoint
UPDATE "accidents" a SET "number" = sub.rn FROM (
  SELECT id, row_number() OVER (PARTITION BY org_id ORDER BY occurred_at, created_at, id) AS rn
  FROM "accidents"
) sub WHERE a.id = sub.id;--> statement-breakpoint
ALTER TABLE "accidents" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accidents_org_id_number" ON "accidents" USING btree ("org_id","number");
