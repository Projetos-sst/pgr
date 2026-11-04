ALTER TABLE "aso_deliveries" DROP CONSTRAINT "ck_aso_deliveries_kind";--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "reviews_id" uuid;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "reviewed_evidence_sha256" text;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "reviewed_evidence_kind" text;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "review_method" text;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "review_result" text;--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD COLUMN "review_reference" text;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_deliveries_evidence_scope" ON "aso_deliveries" USING btree ("id","org_id","health_exam_id","evidence_sha256","evidence_kind");--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "fk_aso_deliveries_reviews" FOREIGN KEY ("reviews_id","org_id","health_exam_id","reviewed_evidence_sha256","reviewed_evidence_kind") REFERENCES "public"."aso_deliveries"("id","org_id","health_exam_id","evidence_sha256","evidence_kind") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_aso_deliveries_reviews" ON "aso_deliveries" USING btree ("reviews_id");--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "ck_aso_deliveries_review" CHECK (("aso_deliveries"."kind" = 'evidence_reviewed') = ("aso_deliveries"."reviews_id" is not null)
        and ("aso_deliveries"."reviews_id" is null) = ("aso_deliveries"."reviewed_evidence_sha256" is null)
        and ("aso_deliveries"."reviews_id" is null) = ("aso_deliveries"."reviewed_evidence_kind" is null)
        and ("aso_deliveries"."reviews_id" is null) = ("aso_deliveries"."review_method" is null)
        and ("aso_deliveries"."reviews_id" is null) = ("aso_deliveries"."review_result" is null)
        and ("aso_deliveries"."reviews_id" is null) = ("aso_deliveries"."review_reference" is null)
        and ("aso_deliveries"."review_method" is null or "aso_deliveries"."review_method" in ('documentary','signature_witnessed'))
        and ("aso_deliveries"."review_result" is null or "aso_deliveries"."review_result" in ('confirmed','rejected'))
        and ("aso_deliveries"."review_reference" is null or char_length(btrim("aso_deliveries"."review_reference")) >= 5)
        and ("aso_deliveries"."review_method" is distinct from 'signature_witnessed' or "aso_deliveries"."reviewed_evidence_kind" = 'signed_receipt')
        and ("aso_deliveries"."reviews_id" is null or "aso_deliveries"."reviews_id" <> "aso_deliveries"."id"));--> statement-breakpoint
ALTER TABLE "aso_deliveries" ADD CONSTRAINT "ck_aso_deliveries_kind" CHECK ("aso_deliveries"."kind" in ('made_available','physical_copy_requested','voided','evidence_reviewed'));--> statement-breakpoint
-- Custom (NOB-167): comprovante corrigido (anulado) não pode ser conferido. A checagem consulta a
-- própria tabela, o que uma policy não pode fazer sem recursão; trigger SECURITY INVOKER (roda com a
-- RLS de quem insere).
CREATE OR REPLACE FUNCTION public.aso_delivery_review_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind = 'evidence_reviewed' AND EXISTS (
    SELECT 1 FROM public.aso_deliveries v
    WHERE v.org_id = NEW.org_id AND v.health_exam_id = NEW.health_exam_id
      AND v.kind = 'voided' AND v.voids_id = NEW.reviews_id
  ) THEN
    RAISE EXCEPTION 'aso_delivery_review_guard: comprovante corrigido não pode ser conferido'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.aso_delivery_review_guard() FROM PUBLIC;--> statement-breakpoint
CREATE TRIGGER aso_deliveries_review_guard BEFORE INSERT ON public.aso_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.aso_delivery_review_guard();