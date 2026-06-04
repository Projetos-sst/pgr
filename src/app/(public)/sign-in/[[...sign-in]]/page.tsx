import { redirect } from "next/navigation";
import { SignIn } from "@clerk/nextjs";

import { getSessionOrNull } from "@/lib/auth/get-session";

export default async function SignInPage() {
  const session = await getSessionOrNull();
  if (session.isAuthenticated) redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <SignIn path="/sign-in" />
    </main>
  );
}
