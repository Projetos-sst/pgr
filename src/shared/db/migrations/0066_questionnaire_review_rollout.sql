-- Existing documents keep their workflow; new documents require independent review.
ALTER TABLE "pgr" ADD COLUMN "technical_review_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "pgr" ALTER COLUMN "technical_review_required" SET DEFAULT true;
--> statement-breakpoint
CREATE FUNCTION public.enforce_pgr_technical_review_rollout() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF current_user='app_runtime' THEN
  IF TG_OP='INSERT' THEN NEW.technical_review_required := true;
  ELSIF OLD.technical_review_required AND NOT NEW.technical_review_required THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='A revisão técnica deste PGR não pode ser desativada.';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enforce_pgr_technical_review_rollout() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER enforce_pgr_technical_review_rollout BEFORE INSERT OR UPDATE OF technical_review_required ON public.pgr FOR EACH ROW EXECUTE FUNCTION public.enforce_pgr_technical_review_rollout();
