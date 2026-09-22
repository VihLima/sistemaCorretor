"use client";
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ImagePlus, Star, Trash2 } from "lucide-react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { removeImageAction, reorderImagesAction, uploadImageAction } from "@/app/painel/imoveis/actions";
import { Button, buttonStyles } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { FormMessage } from "@/components/ui/FormMessage";
import { Spinner } from "@/components/ui/Spinner";
import { initialFormState, type FormState } from "@/lib/form-state";
import { resizeImage } from "@/lib/image-resize";

const MAX_PHOTOS = 20;

type Photo = { id: string; url: string };
type UploadItem = {
  key: string;
  name: string;
  originalSize: number;
  sentSize?: number;
  status: "waiting" | "resizing" | "uploading" | "done" | "error";
  error?: string;
};

const sizeFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${sizeFmt.format(bytes / 1024 / 1024)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const STATUS_TEXT: Record<UploadItem["status"], string> = {
  waiting: "Na fila",
  resizing: "Otimizando…",
  uploading: "Enviando…",
  done: "Enviada",
  error: "Erro",
};

export type PhotoManagerProps = { propertyId: string; images: Photo[] };

/**
 * Fotos do imóvel: envio sequencial (uma por chamada, já redimensionada no navegador),
 * reordenação com ◀ ▶, "Tornar capa" (vai para a 1ª posição) e remoção.
 */
export function PhotoManager({ propertyId, images }: PhotoManagerProps) {
  const [photos, setOptimisticPhotos] = useOptimistic(images);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [state, setState] = useState<FormState>(initialFormState);
  const [uploading, startUpload] = useTransition();
  const [changing, startChange] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const full = photos.length >= MAX_PHOTOS;
  const busy = uploading || changing;

  const patch = (key: string, data: Partial<UploadItem>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...data } : u)));

  const onFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    const batch: UploadItem[] = files.map((f, i) => ({
      key: `${Date.now()}-${i}`,
      name: f.name,
      originalSize: f.size,
      status: "waiting",
    }));
    setUploads(batch);
    setState(initialFormState);

    startUpload(async () => {
      for (const [i, file] of files.entries()) {
        const { key } = batch[i];
        let blob: Blob;
        patch(key, { status: "resizing" });
        try {
          blob = await resizeImage(file);
        } catch {
          patch(key, { status: "error", error: "Não foi possível ler esta imagem. Use JPG, PNG ou WebP." });
          continue;
        }
        patch(key, { status: "uploading", sentSize: blob.size });
        const fd = new FormData();
        fd.append("file", new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        try {
          const result = await uploadImageAction(propertyId, fd);
          if (result.status === "error") {
            patch(key, { status: "error", error: result.fieldErrors?.file ?? result.message });
          } else {
            patch(key, { status: "done" });
          }
        } catch {
          patch(key, { status: "error", error: "Falha no envio. Verifique a conexão e tente de novo." });
        }
      }
    });
  };

  const reorder = (next: Photo[]) => {
    setState(initialFormState);
    startChange(async () => {
      setOptimisticPhotos(next);
      const result = await reorderImagesAction(
        propertyId,
        next.map((p) => p.id),
      );
      if (result.status === "error") setState({ ...result, message: result.fieldErrors?.images ?? result.message });
    });
  };

  const move = (index: number, delta: -1 | 1) => {
    const next = [...photos];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    reorder(next);
  };

  const makeCover = (index: number) => reorder([photos[index], ...photos.filter((_, i) => i !== index)]);

  const remove = (photo: Photo) => {
    if (!window.confirm("Remover esta foto? Esta ação não pode ser desfeita.")) return;
    setState(initialFormState);
    startChange(async () => {
      setOptimisticPhotos(photos.filter((p) => p.id !== photo.id));
      const result = await removeImageAction(photo.id);
      if (result.status === "error") setState(result);
    });
  };

  const doneCount = uploads.filter((u) => u.status === "done").length;
  const processed = uploads.filter((u) => u.status === "done" || u.status === "error").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          <span className="font-medium text-ink tabular-nums">
            {photos.length} de {MAX_PHOTOS}
          </span>{" "}
          fotos. A primeira é a capa da página e dos links compartilhados.
        </p>
        <label
          className={cn(
            buttonStyles(),
            "cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
            (full || uploading) && "pointer-events-none opacity-55",
          )}
        >
          {uploading ? <Spinner label="Enviando fotos" /> : <ImagePlus aria-hidden />}
          {uploading ? "Enviando fotos…" : "Adicionar fotos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={full || uploading}
            onChange={(e) => onFiles(e.target.files)}
            className="sr-only"
          />
        </label>
      </div>

      {uploads.length > 0 && (
        <div className="rounded-control border border-line bg-surface-sunken p-3">
          <p className="mb-2 text-sm font-medium text-ink" aria-live="polite">
            {uploading ? `Enviando ${Math.min(processed + 1, uploads.length)} de ${uploads.length}…` : `${doneCount} de ${uploads.length} enviadas`}
          </p>
          <ul className="flex flex-col gap-1.5">
            {uploads.map((u) => (
              <li key={u.key} className="flex items-start gap-2 text-sm">
                <UploadIcon status={u.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-ink">{u.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink-muted tabular-nums">
                      {u.sentSize ? `${formatSize(u.originalSize)} → ${formatSize(u.sentSize)}` : formatSize(u.originalSize)}
                    </span>
                  </div>
                  <p className={cn("text-xs", u.status === "error" ? "text-danger" : "text-ink-muted")}>
                    {u.status === "error" ? u.error : STATUS_TEXT[u.status]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <FormMessage state={state} />

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-6 py-10 text-center transition-colors hover:border-brand hover:bg-brand-soft/40"
        >
          <span aria-hidden className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand">
            <ImagePlus className="size-6" />
          </span>
          <span className="font-display text-xl text-ink">Nenhuma foto ainda</span>
          <span className="max-w-sm text-sm text-ink-muted">
            Adicione pelo menos uma foto para publicar. Pode escolher várias de uma vez — elas são otimizadas antes do envio.
          </span>
        </button>
      ) : (
        <ol className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", changing && "opacity-80")} aria-busy={busy || undefined}>
          {photos.map((photo, i) => (
            <li key={photo.id} className="overflow-hidden rounded-control border border-line bg-surface">
              <div className="relative aspect-[4/3] bg-surface-sunken">
                {/* eslint-disable-next-line @next/next/no-img-element -- fotos do storage (local ou Supabase) */}
                <img src={photo.url} alt={`Foto ${i + 1}`} loading="lazy" className="size-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-2 left-2 inline-flex h-6 items-center gap-1 rounded-full bg-brand px-2.5 text-xs font-medium text-on-brand shadow-card">
                    <Star aria-hidden className="size-3.5" />
                    Capa
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 p-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-9 px-0"
                  disabled={busy || i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={`Mover foto ${i + 1} para trás`}
                >
                  <ChevronLeft aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-9 px-0"
                  disabled={busy || i === photos.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Mover foto ${i + 1} para frente`}
                >
                  <ChevronRight aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto w-9 px-0"
                  disabled={busy}
                  onClick={() => remove(photo)}
                  aria-label={`Remover foto ${i + 1}`}
                  title="Remover"
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="border-t border-line px-1.5 py-1.5">
                {i === 0 ? (
                  <p className="grid h-9 place-items-center text-sm text-ink-muted">Foto de capa</p>
                ) : (
                  <Button variant="ghost" size="sm" block disabled={busy} onClick={() => makeCover(i)}>
                    Tornar capa
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function UploadIcon({ status }: { status: UploadItem["status"] }) {
  if (status === "done") return <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />;
  if (status === "error") return <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />;
  if (status === "waiting") return <span aria-hidden className="mt-0.5 size-4 shrink-0 rounded-full border-2 border-line-strong" />;
  return (
    <span className="mt-0.5 text-brand">
      <Spinner label={STATUS_TEXT[status]} className="size-4" />
    </span>
  );
}
