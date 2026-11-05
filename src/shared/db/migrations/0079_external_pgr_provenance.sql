ALTER TABLE "medical_risk_sources" ADD COLUMN "document_date" date;--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ADD COLUMN "prepared_by" text;--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ADD COLUMN "review_due_on" date;--> statement-breakpoint
ALTER TABLE "medical_risk_sources" ADD CONSTRAINT "medical_sources_external_provenance_check" CHECK (("medical_risk_sources"."kind" = 'external' or ("medical_risk_sources"."document_date" is null and "medical_risk_sources"."prepared_by" is null and "medical_risk_sources"."review_due_on" is null))
        and ("medical_risk_sources"."review_due_on" is null or "medical_risk_sources"."document_date" is null or "medical_risk_sources"."review_due_on" >= "medical_risk_sources"."document_date"));