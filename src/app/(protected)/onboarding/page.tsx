import { redirect } from "next/navigation";

/**
 * Aposentada (spec 005 / Modelo B): esta rota criava/selecionava organização via
 * Clerk (`CreateOrganization`/`OrganizationList`, Modelo A da fatia 004) — todo
 * usuário já tem um tenant pessoal provisionado automaticamente no cadastro
 * (`provisionPersonalTenant`), então não há mais "criar organização" a fazer
 * aqui. Mantida como redirect (não 404) para não quebrar links/bookmarks antigos.
 */
export default function OnboardingPage() {
  redirect("/welcome");
}
