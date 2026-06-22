import { CreateOrganization, OrganizationList } from "@clerk/nextjs";

export default function OnboardingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <CreateOrganization afterCreateOrganizationUrl="/dashboard" />
      <OrganizationList hidePersonal afterSelectOrganizationUrl="/dashboard" />
    </main>
  );
}
