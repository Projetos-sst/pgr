-- NOB-158/NOB-162: validade da verificação independente de identidade limitada a 12 meses
-- (decisão registrada no Linear; antes o teto técnico era 36 meses).
-- NOT VALID: vale para toda verificação nova e não reescreve nem invalida as existentes.
-- Uma linha antiga com mais de 12 meses de validade não derruba o CD; ela é contada pelo
-- inventário de leitura da homologação e regularizada só com decisão do Carlos (depois:
-- ALTER TABLE ... VALIDATE CONSTRAINT ck_identity_verifications_validity).
ALTER TABLE "professional_identity_verifications" DROP CONSTRAINT "ck_identity_verifications_validity";--> statement-breakpoint
ALTER TABLE "professional_identity_verifications" ADD CONSTRAINT "ck_identity_verifications_validity" CHECK ("professional_identity_verifications"."expires_at" > "professional_identity_verifications"."verified_at" and "professional_identity_verifications"."expires_at" <= "professional_identity_verifications"."verified_at" + interval '12 months') NOT VALID;
