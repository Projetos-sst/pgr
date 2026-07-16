import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { getProfile } from "@/shared/server/actions/platform/profile";

import { EmptyState, PageHeader } from "../_ui/list";
import { ProfileForm } from "./_components/profile-form";

export const dynamic = "force-dynamic";

function DisplayField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-subtle text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-text text-sm">{value || "—"}</span>
    </div>
  );
}

export default async function PerfilPage() {
  await requireOfficeStaffPage();
  const result = await getProfile();

  if (!result.ok) {
    return (
      <div className="flex flex-col gap-6 px-6 py-8">
        <PageHeader title="Meu perfil" />
        <EmptyState message="Não foi possível carregar o perfil." />
      </div>
    );
  }

  const profile = result.data;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex flex-col gap-8 px-6 py-8">
      <PageHeader
        title="Meu perfil"
        description="Seus dados pessoais e profissionais nesta conta."
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-text-subtle text-sm font-semibold tracking-wide uppercase">
          Conta (gerenciada pelo Clerk)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DisplayField label="Nome" value={fullName || null} />
          <DisplayField label="E-mail" value={profile.email} />
        </div>
        <p className="text-text-subtle text-xs">
          Nome, e-mail, foto e senha são gerenciados na sua conta de acesso.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-text-subtle text-sm font-semibold tracking-wide uppercase">
          Dados do perfil
        </h2>
        <ProfileForm
          initial={{
            phone: profile.phone,
            cpf: profile.cpf,
            jobTitle: profile.jobTitle,
          }}
        />
      </section>
    </div>
  );
}
