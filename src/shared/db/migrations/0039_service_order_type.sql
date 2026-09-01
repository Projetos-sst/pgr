ALTER TABLE "service_orders" ADD COLUMN "os_type" "exam_type";--> statement-breakpoint
ALTER TABLE "service_orders" ADD COLUMN "work_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_work_unit_id_work_units_id_fk" FOREIGN KEY ("work_unit_id") REFERENCES "public"."work_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_service_orders_work_unit" ON "service_orders" USING btree ("org_id","work_unit_id");