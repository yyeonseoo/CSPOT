import type { PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { defaultBlue, palette } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export function SoftCheckbox({ checked, label, onToggle, className }: { checked: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-black transition",
        checked ? "border-primary/40 bg-white text-foreground shadow-sm shadow-primary/10" : "border-white/70 bg-white/45 text-muted-foreground hover:bg-white/80",
        className,
      )}
    >
      <span className={cn("grid h-5 w-5 place-items-center rounded-full transition", checked ? "bg-primary text-white" : "bg-sky-100 ring-1 ring-inset ring-primary/20")}>
        {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
      </span>
      {label}
    </button>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block text-base font-bold">{label}<input className="mt-1 w-full rounded-2xl border border-white/80 bg-card/80 px-5 py-4 outline-none transition focus:ring-4 focus:ring-primary/15 dark:border-white/10" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const validValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : defaultBlue;
  return (
    <div className="space-y-3 rounded-2xl border border-white/80 bg-white/55 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black">{label}</p>
          <p className="text-xs font-bold text-muted-foreground">{validValue.toUpperCase()}</p>
        </div>
        <span className="h-10 w-10 shrink-0 rounded-2xl border border-white/80 shadow-inner" style={{ backgroundColor: validValue }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${color} 선택`}
            className={cn("h-9 w-9 rounded-full border-2 shadow-sm transition hover:scale-105", validValue === color ? "border-foreground" : "border-white/80")}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <input
        className="w-full rounded-2xl border border-white/80 bg-card/75 px-4 py-3 text-sm font-black uppercase outline-none transition focus:ring-4 focus:ring-primary/15 dark:border-white/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#7BC7F2"
      />
    </div>
  );
}

export function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-base font-bold">{label}<textarea className="mt-1 min-h-32 w-full rounded-2xl border border-white/80 bg-card/80 px-5 py-4 outline-none transition focus:ring-4 focus:ring-primary/15 dark:border-white/10" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] ?? "없음";

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative block text-base font-bold">
      <p>{label}</p>
      <button
        type="button"
        className={cn(
          "mt-1 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/80 bg-card/80 px-5 py-4 text-left outline-none transition dark:border-white/10",
          open ? "ring-4 ring-primary/15" : "hover:bg-white/90 dark:hover:bg-white/10",
        )}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition", open ? "rotate-90" : "rotate-0")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_18px_48px_rgba(86,144,183,0.18)] backdrop-blur dark:border-white/10 dark:bg-card/95">
          {options.length === 0 ? (
            <div className="rounded-xl px-4 py-3 text-sm text-muted-foreground">없음</div>
          ) : (
            options.map(([optionValue, labelText]) => {
              const selected = optionValue === value;
              return (
                <button
                  key={optionValue}
                  type="button"
                  className={cn("flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-black transition", selected ? "bg-primary/18 text-foreground" : "hover:bg-muted/70")}
                  onClick={() => {
                    onChange(optionValue);
                    setOpen(false);
                  }}
                >
                  <span>{labelText}</span>
                  {selected && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-[1.75rem] border border-white/70 bg-white/84 p-6 shadow-[0_18px_60px_rgba(86,144,183,0.10)] backdrop-blur dark:border-white/10 dark:bg-card/82", className)}><h3 className="mb-5 text-xl font-black">{title}</h3>{children}</section>;
}

export function SwipeActions({ children, onEdit, onDelete }: { children: React.ReactNode; onEdit: () => void; onDelete: () => void }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);
  const actionWidth = 132;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    startX.current = event.clientX;
    startOffset.current = offset;
    moved.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const distance = event.clientX - startX.current;
    if (Math.abs(distance) > 8) {
      moved.current = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
    setOffset(Math.max(-actionWidth, Math.min(0, startOffset.current + distance)));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (startX.current === null) return;
    const finalOffset = Math.max(-actionWidth, Math.min(0, startOffset.current + event.clientX - startX.current));
    setOffset(finalOffset < -42 ? -actionWidth : 0);
    startX.current = null;
  }

  function handlePointerCancel() {
    setOffset(0);
    startX.current = null;
  }

  return (
    <div className="relative overflow-hidden rounded-3xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[132px] overflow-hidden rounded-r-3xl transition-opacity duration-150"
        style={{ opacity: offset < 0 ? 1 : 0, pointerEvents: offset < 0 ? "auto" : "none" }}
        aria-hidden={offset === 0}
      >
        <button type="button" className="grid flex-1 place-items-center bg-primary text-primary-foreground" aria-label="수정" onClick={() => { setOffset(0); onEdit(); }}>
          <Pencil size={18} />
        </button>
        <button type="button" className="grid flex-1 place-items-center bg-destructive text-destructive-foreground" aria-label="삭제" onClick={() => { setOffset(0); onDelete(); }}>
          <Trash2 size={18} />
        </button>
      </div>
      <div
        className="relative touch-pan-y transition-transform duration-200"
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function TwoColumn({ children }: { children: React.ReactNode }) {
  return <section className="grid gap-5 xl:grid-cols-[380px_1fr]">{children}</section>;
}

export function DataList({ title, items }: { title: string; items: Array<{ id: string; title: string; meta: string }> }) {
  return <Panel title={title}><div className="grid gap-2">{items.length === 0 && <p className="text-sm text-muted-foreground">표시할 항목이 없습니다.</p>}{items.map((item) => <div key={item.id} className="rounded-[1.1rem] border border-white/80 bg-card/68 p-4 dark:border-white/10"><p className="font-black">{item.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.meta}</p></div>)}</div></Panel>;
}

export function PrimaryButton({ children, onClick, disabled, icon, className }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon?: React.ReactNode; className?: string }) {
  return <button className={cn("flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-50", className)} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

export function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button className="rounded-2xl bg-muted/70 p-3" onClick={onClick} aria-label={label}>{children}</button>;
}

export function segmentClass(active: boolean) {
  return cn("rounded-[1rem] px-3 py-3 text-sm font-black transition", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground");
}
