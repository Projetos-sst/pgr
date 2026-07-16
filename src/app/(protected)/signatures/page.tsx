import { requireOfficeStaffPage } from "@/shared/auth/page-guards";

import { SignaturePanel } from "./_components/signature-panel";

export const dynamic = "force-dynamic";

export default async function SignaturesPage() {
  await requireOfficeStaffPage();

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-text text-2xl font-semibold tracking-tight">Assinaturas</h1>
        <p className="text-text-muted text-sm">
          Gere um link/QR de assinatura (demonstração) e acompanhe a confirmação em tempo
          real.
        </p>
      </header>
      <SignaturePanel />
    </div>
  );
}
