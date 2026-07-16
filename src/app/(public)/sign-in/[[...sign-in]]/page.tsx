import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import { getSessionOrNull } from "@/shared/auth/get-session";
import { AuthFrame } from "@/app/_components/auth-frame";
import { clerkAppearance } from "@/app/_components/clerk-appearance";

export default async function SignInPage() {
  const session = await getSessionOrNull();
  if (session.isAuthenticated) redirect("/dashboard");

  return (
    <AuthFrame eyebrow="Plataforma SST">
      <SignIn path="/sign-in" appearance={clerkAppearance} />
    </AuthFrame>
  );
}
