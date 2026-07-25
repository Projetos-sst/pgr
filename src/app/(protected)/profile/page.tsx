import Link from "next/link";

import { requireOfficeStaffPage } from "@/shared/auth/page-guards";
import { ROLE_LABEL, type AssignableRole } from "@/shared/domains/platform/team";
import { getProfile } from "@/shared/server/actions/platform/profile";
import { listTeamMembers } from "@/shared/server/actions/platform/team";
import { isTeamManagementAvailable } from "@/shared/tenant/plan";

import { EmptyState, PageHeader } from "../_ui/list";
import { InviteMemberForm, MemberActions } from "../team/_components/team-actions";
import { ProfileForm } from "./_components/profile-form";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string; search?: string; page?: string }>;

function DisplayField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-subtle text-xs font-medium tracking-wide uppercase">
        {label}
      </span>
      <span className="text-text font-semibold text-sm">{value || "—"}</span>
    </div>
  );
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const ctx = await requireOfficeStaffPage();
  const sp = await searchParams;
  const activeTab = sp.tab ?? "profile";
  const searchQuery = sp.search ?? "";
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getProfile();
  const isOwner = ctx.role === "owner";
  const isPro = isTeamManagementAvailable(ctx.plan);
  const canManageTeam = isOwner && isPro;

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

  // Se a aba for "team", carrega a lista de membros da equipe
  let teamMembers: any[] = [];
  let totalMembers = 0;
  if (activeTab === "team") {
    const teamRes = await listTeamMembers({ search: searchQuery, page });
    if (teamRes.ok) {
      teamMembers = teamRes.data.rows;
      totalMembers = teamRes.data.total;
    }
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      {/* Top Header com Breadcrumb */}
      <div className="glass-panel flex flex-col gap-3 rounded-2xl border border-white/60 p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5b63f5]/15 text-[#5b63f5]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#1b1f2e]">Meu Perfil</h1>
            <nav className="flex items-center gap-1.5 text-xs text-[#8c91a8]">
              <Link href="/welcome" className="hover:text-[#5b63f5]">Usuário</Link>
              <span>›</span>
              <span className="font-semibold text-[#52576e]">Perfil</span>
            </nav>
          </div>
        </div>

        {/* Tab Bar de Navegação (Perfil / Segurança / Equipe e Acessos) */}
        <div className="mt-2 flex items-center gap-2 border-t border-black/5 pt-3">
          <Link
            href="/profile?tab=profile"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "profile"
                ? "bg-[#5b63f5] text-white shadow-md shadow-[#5b63f5]/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>Perfil</span>
          </Link>

          <Link
            href="/profile?tab=security"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "security"
                ? "bg-[#5b63f5] text-white shadow-md shadow-[#5b63f5]/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Segurança</span>
          </Link>

          <Link
            href="/profile?tab=team"
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "team"
                ? "bg-[#5b63f5] text-white shadow-md shadow-[#5b63f5]/30"
                : "bg-white/50 text-[#52576e] hover:bg-white/80"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span>Equipe e Acessos</span>
            {!isPro ? (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-700">PRO</span>
            ) : null}
          </Link>
        </div>
      </div>

      {/* Conteúdo da Aba 1: PERFIL */}
      {activeTab === "profile" ? (
        <div className="flex flex-col gap-6">
          <section className="glass-panel flex flex-col gap-4 rounded-2xl border border-white/60 p-6 shadow-md">
            <h2 className="text-xs font-extrabold tracking-wider uppercase text-[#8c91a8]">
              Dados de Acesso (Gerenciados pela Plataforma)
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DisplayField label="Nome Completo" value={fullName || null} />
              <DisplayField label="E-mail de Login" value={profile.email} />
            </div>
          </section>

          <section className="glass-panel flex flex-col gap-4 rounded-2xl border border-white/60 p-6 shadow-md">
            <h2 className="text-xs font-extrabold tracking-wider uppercase text-[#8c91a8]">
              Dados do Perfil Profissional
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
      ) : null}

      {/* Conteúdo da Aba 2: SEGURANÇA */}
      {activeTab === "security" ? (
        <div className="flex flex-col gap-6">
          <section className="glass-panel flex flex-col gap-5 rounded-2xl border border-white/60 p-6 shadow-md">
            <div>
              <h2 className="text-base font-extrabold text-[#1b1f2e]">Segurança da Conta</h2>
              <p className="text-xs font-medium text-[#7a7f97]">
                Gerencie suas credenciais de acesso, alteração de senha e fatores de autenticação.
              </p>
            </div>

            <div className="flex flex-col gap-4 border-t border-black/5 pt-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#1b1f2e]">Senha de Acesso</h4>
                  <p className="text-xs font-medium text-[#8c91a8]">
                    Altere sua senha de login periodicamente para garantir a segurança da conta.
                  </p>
                </div>
                <Link
                  href="https://accounts.clerk.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#5b63f5] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#5b63f5]/25 transition-transform hover:scale-[1.02]"
                >
                  Alterar Senha →
                </Link>
              </div>

              <div className="flex flex-col gap-1 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-[#1b1f2e]">Autenticação em Duas Etapas (2FA)</h4>
                  <p className="text-xs font-medium text-[#8c91a8]">
                    Adicione uma camada extra de proteção via aplicativo autenticador ou SMS.
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700">
                  Proteção Ativa
                </span>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {/* Conteúdo da Aba 3: EQUIPE E ACESSOS */}
      {activeTab === "team" ? (
        <div className="flex flex-col gap-6">
          <div className="glass-panel flex flex-col gap-4 rounded-2xl border border-white/60 p-6 shadow-md">
            {/* Top Bar da Gestão de Usuários */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#1b1f2e]">Gestão de Usuários</h2>
                <p className="text-xs font-medium text-[#7a7f97]">
                  Administre os acessos e permissões da sua equipe no escritório.
                </p>
              </div>

              {canManageTeam ? (
                <div className="shrink-0">
                  <InviteMemberForm />
                </div>
              ) : null}
            </div>

            {!isPro ? (
              <div className="mt-2 rounded-2xl border border-amber-300 bg-amber-500/10 p-4 text-amber-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white font-extrabold">
                    ★
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold">Recurso do Plano PRO</h4>
                    <p className="text-xs font-medium text-amber-900">
                      A gestão de múltiplos usuários e convite de colaboradores é um recurso exclusivo do Plano PRO. Faça upgrade para adicionar colaboradores à sua equipe.
                    </p>
                  </div>
                  <Link
                    href="/plans"
                    className="ml-auto shrink-0 rounded-xl bg-[#5b63f5] px-4 py-2 text-xs font-extrabold text-white shadow-md shadow-[#5b63f5]/30 hover:scale-105 transition-transform"
                  >
                    Fazer Upgrade →
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Busca de Membros */}
            <form method="GET" className="mt-2 flex items-center gap-2">
              <input type="hidden" name="tab" value="team" />
              <div className="relative flex-1">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9095ad"
                  strokeWidth="2"
                  className="absolute left-3.5 top-1/2 -translate-y-1/2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  name="search"
                  defaultValue={searchQuery}
                  placeholder="Buscar usuários por nome, e-mail ou cargo..."
                  className="w-full rounded-xl border border-white/60 bg-white/50 py-2.5 pl-10 pr-4 text-xs font-medium text-[#1b1f2e] placeholder-[#9095ad] backdrop-blur-md outline-none focus:border-[#5b63f5]"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[#5b63f5] px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-[#5b63f5]/25"
              >
                Buscar
              </button>
            </form>

            {/* Tabela de Membros de Usuário */}
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/70 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-[#52576e]">
                  <tr>
                    <th className="px-4 py-3">Usuário</th>
                    <th className="px-4 py-3">Cargo</th>
                    <th className="px-4 py-3">Tipo / Papel</th>
                    <th className="px-4 py-3">Permissões Gerais</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Opções</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-[#1b1f2e]">
                  {teamMembers.length > 0 ? (
                    teamMembers.map((member) => (
                      <tr key={member.userId} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#5b63f5] font-extrabold text-white text-xs">
                              {member.name ? member.name.charAt(0).toUpperCase() : "U"}
                            </span>
                            <div>
                              <div>{member.name || "Usuário"}</div>
                              <div className="text-[11px] font-normal text-[#8c91a8]">{member.email ?? "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">{member.jobTitle ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-700">
                            {ROLE_LABEL[member.role as AssignableRole] ?? member.roleLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#7a7f97]">Acesso ao Sistema</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-700">
                            Ativo
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canManageTeam ? (
                            <MemberActions
                              userId={member.userId}
                              role={member.role}
                              isSelf={member.userId === ctx.userId}
                            />
                          ) : (
                            <span className="text-[#8c91a8]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-[#8c91a8]">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="23" y1="11" x2="17" y2="11" />
                          </svg>
                          <p className="mt-2 text-sm font-bold text-[#1b1f2e]">Nenhum usuário encontrado</p>
                          <p className="text-xs">Não há colaboradores registrados para o filtro selecionado.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
