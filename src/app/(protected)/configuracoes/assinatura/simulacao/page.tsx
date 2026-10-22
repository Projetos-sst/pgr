import { CommercialScreen } from "../../_components/commercial-screen";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  return <CommercialScreen section="simulation" session={(await searchParams).session} />;
}
