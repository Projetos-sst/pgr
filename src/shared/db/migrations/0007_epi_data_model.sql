CREATE TYPE "public"."epi_signature_status" AS ENUM('pending', 'signed_qr', 'signed_link', 'signed_manual');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('purchase', 'employee_delivery', 'adjustment', 'discard');--> statement-breakpoint
CREATE TABLE "epi_catalog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"type" "category_type" NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"ca" text,
	"ca_valid_until" date,
	"manufacturer" text,
	"norm" text,
	"size" text,
	"unit_of_measure" text,
	"description" text,
	"photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epi_catalog" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "epi_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"delivery_date" date DEFAULT now() NOT NULL,
	"signature_status" "epi_signature_status" DEFAULT 'pending' NOT NULL,
	"auth_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epi_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "epi_delivery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"delivery_id" uuid NOT NULL,
	"catalog_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "epi_delivery_items_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
ALTER TABLE "epi_delivery_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "epi_risk" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"catalog_id" uuid NOT NULL,
	"ges_id" uuid NOT NULL,
	"neutralizes" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "epi_risk" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "epi_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"catalog_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"min_quantity" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "epi_stock_balance_check" CHECK (balance >= 0),
	CONSTRAINT "epi_stock_min_quantity_check" CHECK (min_quantity >= 0)
);
--> statement-breakpoint
ALTER TABLE "epi_stock" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" text NOT NULL,
	"stock_id" uuid NOT NULL,
	"delivery_id" uuid,
	"type" "stock_movement_type" NOT NULL,
	"quantity" integer NOT NULL,
	"movement_date" date DEFAULT now() NOT NULL,
	"invoice_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_quantity_check" CHECK (quantity > 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD CONSTRAINT "epi_catalog_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_catalog" ADD CONSTRAINT "epi_catalog_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_deliveries" ADD CONSTRAINT "epi_deliveries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_delivery_items" ADD CONSTRAINT "epi_delivery_items_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_delivery_items" ADD CONSTRAINT "epi_delivery_items_delivery_id_epi_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."epi_deliveries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_delivery_items" ADD CONSTRAINT "epi_delivery_items_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_risk" ADD CONSTRAINT "epi_risk_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_risk" ADD CONSTRAINT "epi_risk_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_risk" ADD CONSTRAINT "epi_risk_ges_id_ges_id_fk" FOREIGN KEY ("ges_id") REFERENCES "public"."ges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_stock" ADD CONSTRAINT "epi_stock_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epi_stock" ADD CONSTRAINT "epi_stock_catalog_id_epi_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."epi_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_stock_id_epi_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."epi_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_delivery_id_epi_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."epi_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_epi_catalog_org_id" ON "epi_catalog" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_epi_catalog_category_id" ON "epi_catalog" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_epi_deliveries_org_id" ON "epi_deliveries" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_epi_deliveries_employee_id" ON "epi_deliveries" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_epi_deliveries_auth_token" ON "epi_deliveries" USING btree ("auth_token") WHERE auth_token is not null;--> statement-breakpoint
CREATE INDEX "idx_epi_delivery_items_org_id" ON "epi_delivery_items" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_epi_delivery_items_delivery_id" ON "epi_delivery_items" USING btree ("delivery_id");--> statement-breakpoint
CREATE INDEX "idx_epi_delivery_items_catalog_id" ON "epi_delivery_items" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_epi_risk_org_id" ON "epi_risk" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_epi_risk_catalog_id" ON "epi_risk" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "idx_epi_risk_ges_id" ON "epi_risk" USING btree ("ges_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_epi_risk_org_catalog_ges" ON "epi_risk" USING btree ("org_id","catalog_id","ges_id");--> statement-breakpoint
CREATE INDEX "idx_epi_stock_org_id" ON "epi_stock" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_epi_stock_org_catalog" ON "epi_stock" USING btree ("org_id","catalog_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_org_id" ON "stock_movements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_stock_id" ON "stock_movements" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "idx_stock_movements_delivery_id" ON "stock_movements" USING btree ("delivery_id");--> statement-breakpoint
CREATE POLICY "epi_catalog_isolation" ON "epi_catalog" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "epi_deliveries_isolation" ON "epi_deliveries" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "epi_delivery_items_isolation" ON "epi_delivery_items" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "epi_risk_isolation" ON "epi_risk" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "epi_stock_isolation" ON "epi_stock" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
CREATE POLICY "stock_movements_isolation" ON "stock_movements" AS PERMISSIVE FOR ALL TO "app_runtime" USING (org_id = current_setting('app.current_org', true)) WITH CHECK (org_id = current_setting('app.current_org', true));--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_catalog TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_stock TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_deliveries TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_delivery_items TO app_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epi_risk TO app_runtime;--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_epi_catalog ON public.epi_catalog;--> statement-breakpoint
CREATE TRIGGER set_updated_at_epi_catalog BEFORE UPDATE ON public.epi_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_epi_stock ON public.epi_stock;--> statement-breakpoint
CREATE TRIGGER set_updated_at_epi_stock BEFORE UPDATE ON public.epi_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_stock_movements ON public.stock_movements;--> statement-breakpoint
CREATE TRIGGER set_updated_at_stock_movements BEFORE UPDATE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_epi_deliveries ON public.epi_deliveries;--> statement-breakpoint
CREATE TRIGGER set_updated_at_epi_deliveries BEFORE UPDATE ON public.epi_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_epi_delivery_items ON public.epi_delivery_items;--> statement-breakpoint
CREATE TRIGGER set_updated_at_epi_delivery_items BEFORE UPDATE ON public.epi_delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS set_updated_at_epi_risk ON public.epi_risk;--> statement-breakpoint
CREATE TRIGGER set_updated_at_epi_risk BEFORE UPDATE ON public.epi_risk
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();