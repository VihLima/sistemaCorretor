import { AtSign, BadgeCheck } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type PublicAgent = {
  name: string;
  photoUrl: string | null;
  creci: string | null;
  agencyName: string | null;
  bio: string | null;
  instagramUrl: string | null;
};

function instagramHandle(url: string) {
  try {
    const handle = new URL(url).pathname.split("/").filter(Boolean)[0];
    return handle ? `@${handle}` : "Instagram";
  } catch {
    return "Instagram";
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Corretor responsável. Sem link direto de WhatsApp: o contato passa sempre pelo questionário. */
export function AgentCard({ agent, className }: { agent: PublicAgent; className?: string }) {
  return (
    <section aria-labelledby="corretor-titulo" className={cn("flex flex-col gap-4", className)}>
      <h2 id="corretor-titulo" className="text-sm font-medium text-ink-muted">
        Corretor responsável
      </h2>
      <div className="flex items-center gap-4">
        {agent.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do storage (local ou Supabase)
          <img src={agent.photoUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-xl text-brand">
            {initials(agent.name)}
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-display text-[1.375rem] leading-tight text-ink">{agent.name}</p>
          {agent.creci && (
            <p className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
              <BadgeCheck aria-hidden className="size-4 text-brand" />
              CRECI {agent.creci}
            </p>
          )}
          {agent.agencyName && <p className="text-sm text-ink-muted">{agent.agencyName}</p>}
        </div>
      </div>
      {agent.bio && <p className="text-[0.9375rem] leading-relaxed whitespace-pre-line text-ink-muted">{agent.bio}</p>}
      {agent.instagramUrl && (
        <a
          href={agent.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 self-start text-[0.9375rem] font-medium text-brand underline-offset-4 hover:underline"
        >
          <AtSign aria-hidden className="size-4" />
          {instagramHandle(agent.instagramUrl)} no Instagram
        </a>
      )}
    </section>
  );
}
