import { RegisterSW } from "@/components/painel/RegisterSW";
import { Shell } from "@/components/painel/Shell";
import { requireUser } from "@/server/auth/current";

export default async function PainelLayout({ children }: LayoutProps<"/painel">) {
  const user = await requireUser();
  return (
    <Shell user={user}>
      <RegisterSW />
      {children}
    </Shell>
  );
}
