import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InterestFlow } from "@/components/publico/InterestFlow";
import { CONSENT_TEXT } from "@/domain/consent";
import { getPublicPropertyBySlug } from "@/server/services/properties";
import { getPublicQuestions } from "@/server/services/public-leads";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tenho interesse", robots: { index: false } };

export default async function InterestPage({ params }: PageProps<"/imovel/[slug]/interesse">) {
  const { slug } = await params;
  const p = await getPublicPropertyBySlug(slug);
  if (!p) notFound();
  if (p.status !== "PUBLISHED") redirect(`/imovel/${slug}`);
  const questions = await getPublicQuestions(p.id);

  return (
    <InterestFlow
      property={{
        id: p.id,
        title: p.title,
        slug: p.slug,
        coverUrl: p.images[0]?.url ?? null,
        agentName: p.agent.name,
        agentPhotoUrl: p.agent.photoUrl,
      }}
      questions={questions}
      consentText={CONSENT_TEXT}
    />
  );
}
