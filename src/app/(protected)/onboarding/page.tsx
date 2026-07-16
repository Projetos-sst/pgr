import { CreateOrganization, OrganizationList } from "@clerk/nextjs";

import { AuthFrame } from "@/app/_components/auth-frame";
import { clerkAppearance } from "@/app/_components/clerk-appearance";

export default function OnboardingPage() {
  return (
    <AuthFrame eyebrow="Primeiros passos" title="Crie ou escolha sua organização">
      <div className="flex w-full flex-col items-center gap-8">
        <CreateOrganization
          afterCreateOrganizationUrl="/dashboard"
          appearance={clerkAppearance}
        />
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/dashboard"
          appearance={clerkAppearance}
        />
      </div>
    </AuthFrame>
  );
}
