CREATE TYPE "public"."nr09_conclusion" AS ENUM('below_limit', 'above_limit', 'not_applicable');--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN "evaluation_method" text;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN "measured_value" numeric;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN "measured_unit" "measurement_unit";--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN "tolerance_limit_value" numeric;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN "nr09_conclusion" "nr09_conclusion";--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_measured_unit_check" CHECK (measured_value is null or (measured_unit is not null and measured_unit <> 'qualitative_na'));--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_quantitative_criterion_check" CHECK (criterion = 'quantitative' or (measured_value is null and measured_unit is null and tolerance_limit_value is null and nr09_conclusion is null and evaluation_method is null));