"use client";

// features/knowledge-base/components/knowledge-base-view.tsx
// Full-width CRUD library of reusable templates, prompts, guides, references,
// case studies and snippets. Filter by type/tag/search, with an inline editor.

import { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Tag,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  createKnowledgeItemAction,
  deleteKnowledgeItemAction,
  updateKnowledgeItemAction,
} from "@/features/knowledge-base/actions";
import {
  KB_TYPES,
  KB_TYPE_META,
  type KbData,
  type KbInput,
  type KbItem,
  type KbType,
} from "@/features/knowledge-base/types";

interface Props {
  initialData: KbData;
}

const EMPTY_FORM: KbInput = { type: "TEMPLATE", title: "", content: "", tags: [] };

export function KnowledgeBaseView({ initialData }: Props) {
  const [data, setData] = useState<KbData>(initialData);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  // Filters
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<KbType | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Editor
  const [editing, setEditing] = useState<KbItem | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.items.filter((it) => {
      if (typeFilter !== "all" && it.type !== typeFilter) return false;
      if (tagFilter && !it.tags.includes(tagFilter)) return false;
      if (needle) {
        const hay = `${it.title} ${it.content} ${it.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [data.items, q, typeFilter, tagFilter]);

  function save(input: KbInput) {
    setError("");
    startTransition(async () => {
      const result = editing
        ? await updateKnowledgeItemAction(editing.id, input)
        : await createKnowledgeItemAction(input);
      if (result.ok) {
        setData(result.data);
        setEditing(null);
        setCreating(false);
      } else {
        setError(result.error);
      }
    });
  }

  function remove(id: string) {
    setError("");
    startTransition(async () => {
      const result = await deleteKnowledgeItemAction(id);
      if (result.ok) setData(result.data);
      else setError(result.error);
    });
  }

  const showEditor = creating || editing !== null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 text-lg font-semibold leading-tight text-foreground">
            <BookOpen className="h-4 w-4" />
            Knowledge Base
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tu biblioteca de plantillas, prompts, guías y fragmentos reutilizables.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setCreating(true);
            setError("");
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo elemento
        </button>
      </div>

      {error && (
        <p className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      )}

      {showEditor && (
        <Editor
          initial={editing ?? EMPTY_FORM}
          isEdit={editing !== null}
          pending={pending}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSave={save}
        />
      )}

      {/* Type filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
          Todos ({data.items.length})
        </FilterChip>
        {KB_TYPES.map((t) => (
          <FilterChip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            disabled={data.countsByType[t] === 0}
          >
            {KB_TYPE_META[t].label} ({data.countsByType[t]})
          </FilterChip>
        ))}
      </div>

      {/* Search + tags */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por título, contenido o etiqueta…"
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
        {tagFilter && (
          <button
            onClick={() => setTagFilter(null)}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs text-primary"
          >
            <Tag className="h-3 w-3" /> {tagFilter}
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {data.tags.length > 0 && !tagFilter && (
        <div className="flex flex-wrap gap-1.5">
          {data.tags.slice(0, 16).map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Tag className="h-2.5 w-2.5" />
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Items grid */}
      {data.items.length === 0 ? (
        <EmptyState onCreate={() => setCreating(true)} />
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {data.items.length} elementos
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                pending={pending}
                onEdit={() => {
                  setCreating(false);
                  setEditing(it);
                  setError("");
                }}
                onDelete={() => remove(it.id)}
                onTag={setTagFilter}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Ningún elemento coincide con los filtros.
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function Editor({
  initial,
  isEdit,
  pending,
  onCancel,
  onSave,
}: {
  initial: KbInput | KbItem;
  isEdit: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: (input: KbInput) => void;
}) {
  const [type, setType] = useState<KbType>(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [tagInput, setTagInput] = useState("");

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  const valid = title.trim() && content.trim();

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {isEdit ? "Editar elemento" : "Nuevo elemento"}
          </p>
          <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as KbType)}
            aria-label="Tipo"
            className="h-9 rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
          >
            {KB_TYPES.map((t) => (
              <option key={t} value={t}>
                {KB_TYPE_META[t].label}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título…"
            className="h-9 rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Contenido… (texto, prompt, plantilla, snippet)"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />

        {/* Tags */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-foreground"
              >
                {t}
                <button
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                  className="text-muted-foreground hover:text-rose-400"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Añadir etiqueta y Enter…"
            className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={() => valid && onSave({ type, title, content, tags })}
            disabled={!valid || pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  pending,
  onEdit,
  onDelete,
  onTag,
}: {
  item: KbItem;
  pending: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const meta = KB_TYPE_META[item.type];

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card className="flex flex-col border-border">
      <CardContent className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={cn("text-[10px]", meta.badge)}>
            {meta.label}
          </Badge>
          <div className="flex items-center gap-1">
            <IconBtn title="Copiar" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </IconBtn>
            <IconBtn title="Editar" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
            {confirming ? (
              <button
                onClick={onDelete}
                disabled={pending}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-400 hover:bg-rose-500/10"
              >
                ¿Borrar?
              </button>
            ) : (
              <IconBtn title="Eliminar" onClick={() => setConfirming(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            )}
          </div>
        </div>

        <p className="text-sm font-medium leading-snug text-foreground">{item.title}</p>
        <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
          {item.content}
        </p>

        {item.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {item.tags.map((t) => (
              <button
                key={t}
                onClick={() => onTag(t)}
                className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Tag className="h-2.5 w-2.5" />
                {t}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Small pieces ─────────────────────────────────────────────────────────────

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-12 text-center">
      <BookOpen className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Tu base de conocimiento está vacía</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          Guarda plantillas de propuestas, prompts que funcionan, guías internas, casos de uso y
          snippets reutilizables. Todo en un solo sitio, buscable y etiquetado.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        Crear el primero
      </button>
    </div>
  );
}
