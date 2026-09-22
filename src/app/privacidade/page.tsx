import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = {
  title: "Política de privacidade",
  robots: { index: false },
};

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "Quem é o controlador e o operador",
    body: (
      <p>
        O <strong>corretor responsável pelo imóvel</strong> anunciado é o controlador dos dados coletados: é ele
        quem decide como usar as informações de contato para atendê-lo. A <strong>Corretor Leads</strong> atua como
        operadora da plataforma, processando os dados em nome do corretor para viabilizar o funcionamento do site.
      </p>
    ),
  },
  {
    title: "Quais dados coletamos",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Nome</li>
        <li>WhatsApp</li>
        <li>E-mail (opcional)</li>
        <li>Respostas do questionário de qualificação</li>
        <li>Origem da visita (ex.: Instagram, Facebook, Google, QR Code)</li>
        <li>Identificador anônimo do navegador (não coletamos endereço IP)</li>
      </ul>
    ),
  },
  {
    title: "Finalidade do tratamento",
    body: <p>Os dados são usados para entrar em contato sobre o imóvel de interesse e para qualificar o atendimento, evitando contatos genéricos.</p>,
  },
  {
    title: "Base legal",
    body: (
      <p>
        O tratamento é feito com base no consentimento do titular, dado ao enviar o formulário de interesse (
        <strong>base legal a validar com um advogado</strong>).
      </p>
    ),
  },
  {
    title: "Compartilhamento de dados",
    body: <p>Os dados são compartilhados apenas com o corretor responsável pelo imóvel sobre o qual você demonstrou interesse.</p>,
  },
  {
    title: "Prazo de retenção",
    body: (
      <p>
        <strong>A definir.</strong> O prazo de retenção dos dados ainda será estabelecido em revisão jurídica futura.
      </p>
    ),
  },
  {
    title: "Direitos do titular",
    body: (
      <p>
        Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento, entrando em contato
        diretamente com o corretor responsável pelo imóvel.
      </p>
    ),
  },
  {
    title: "Contato do encarregado (DPO)",
    body: (
      <p>
        <strong>A definir.</strong> As informações de contato do encarregado de proteção de dados serão publicadas
        aqui após a revisão jurídica.
      </p>
    ),
  },
];

export default function PrivacidadePage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <strong>Modelo pendente de revisão jurídica.</strong> Este texto é um ponto de partida e deve ser revisado
          por um advogado antes do uso comercial.
        </div>

        <h1 className="font-display text-3xl tracking-[-0.01em] text-ink">Política de privacidade</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Esta página explica como os dados enviados pelo formulário de interesse em um imóvel são tratados.
        </p>

        <div className="mt-6 space-y-4">
          {sections.map((s) => (
            <Card key={s.title} title={s.title} titleAs="h2">
              <div className="space-y-2 text-sm leading-relaxed text-ink">{s.body}</div>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-sm text-ink-muted">
          <Link href="/" className="inline-flex min-h-12 items-center underline-offset-4 hover:underline">
            Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}
