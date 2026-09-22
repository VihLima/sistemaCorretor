import { CHANNEL_LABELS } from "@/domain/labels";
import type { Channel } from "@/domain/types";

/** Contatos por origem em barras horizontais (largura em CSS, relativa ao maior canal). */
export function ChannelBars({ data }: { data: { channel: Channel; count: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-ink-muted">Nenhum contato no período.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.channel}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink">{CHANNEL_LABELS[d.channel]}</span>
            <span className="text-ink-muted tabular-nums">
              <span className="font-medium text-ink">{d.count}</span>
              <span className="sr-only"> contatos</span>
              <span className="ml-1.5 text-xs">({Math.round((d.count / total) * 100)}%)</span>
            </span>
          </div>
          <div aria-hidden className="mt-1 h-2 rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
