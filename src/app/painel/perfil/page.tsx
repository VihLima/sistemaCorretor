import { Hand, LogOut } from "lucide-react";
import type { Metadata } from "next";
import { logoutAction } from "@/app/(auth)/actions";
import { ProfileForm } from "@/components/painel/ProfileForm";
import { Button } from "@/components/ui/Button";
import { requireUser } from "@/server/auth/current";
import { getProfile } from "@/server/services/profile";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage({ searchParams }: PageProps<"/painel/perfil">) {
  const user = await requireUser();
  const profile = await getProfile(user);
  const welcome = (await searchParams)["boas-vindas"] === "1";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-[2rem] leading-tight tracking-[-0.015em] text-ink">Perfil</h1>
        <p className="mt-1 text-ink-muted">Seus dados aparecem na página de cada imóvel publicado.</p>
      </header>

      {welcome && (
        <p role="status" className="flex items-start gap-2.5 rounded-card bg-brand-soft px-4 py-3 text-sm text-ink">
          <Hand aria-hidden className="mt-px size-4 shrink-0 text-brand" />
          <span>
            <strong className="font-semibold">Complete seu perfil</strong> — o WhatsApp é obrigatório para publicar imóveis.
          </span>
        </p>
      )}

      <ProfileForm
        profile={{
          name: profile.name,
          whatsapp: profile.whatsapp,
          phone: profile.phone,
          creci: profile.creci,
          agencyName: profile.agencyName,
          instagramUrl: profile.instagramUrl,
          bio: profile.bio,
          photoUrl: profile.photoUrl,
        }}
      />

      {/* no desktop o "Sair" fica na barra lateral */}
      <form action={logoutAction} className="border-t border-line pt-6 lg:hidden">
        <Button type="submit" variant="secondary" block>
          <LogOut aria-hidden />
          Sair
        </Button>
      </form>
    </div>
  );
}
