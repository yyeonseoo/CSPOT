import type { PointerEvent as ReactPointerEvent } from "react";
import { Check, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { defaultAccent, palette } from "@/lib/schedule";
import { timeOptions } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SoftCheckbox({ checked, label, onToggle, className }: { checked: boolean; label: string; onToggle: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition",
        checked ? "bg-white text-foreground" : "bg-background text-muted-foreground hover:bg-background",
        className,
      )}
    >
      <span className={cn("grid h-4 w-4 place-items-center rounded transition", checked ? "bg-primary text-primary-foreground" : "bg-background")}>
        {checked && <Check className="h-3 w-3 stroke-[3]" />}
      </span>
      {label}
    </button>
  );
}

// 날짜는 기기 달력, 시간은 24시간 10분 단위 선택. value 형식: "2026-10-01T18:00"
export function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [date, time = "00:00"] = value.split("T");
  return (
    <div className="text-sm font-medium">
      <p>{label}</p>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-2">
        <input className="mt-1 w-full min-w-0 rounded-xl bg-background px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary/20" type="date" value={date} onChange={(event) => onChange(`${event.target.value}T${time}`)} />
        <Select label="" value={time} onChange={(next) => onChange(`${date}T${next}`)} options={timeOptions(time).map((item) => [item, item])} />
      </div>
    </div>
  );
}

export function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block text-sm font-medium">{label}<input className="mt-1 w-full rounded-xl bg-background px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-primary/20" type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const validValue = /^#[0-9A-Fa-f]{6}$/.test(value) ? value : defaultAccent;
  return (
    <div className="space-y-3 rounded-xl bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{label}</p>
          <p className="text-xs font-medium text-muted-foreground">{validValue.toUpperCase()}</p>
        </div>
        <span className="h-10 w-10 shrink-0 rounded-xl" style={{ backgroundColor: validValue }} />
      </div>
      <div className="flex flex-wrap gap-2">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${color} 선택`}
            className={cn("h-9 w-9 rounded-full shadow-sm transition hover:scale-105", validValue === color && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
      <input
        className="w-full rounded-xl bg-background px-4 py-3 text-sm font-semibold uppercase outline-none transition focus:ring-2 focus:ring-primary/30"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#7BC7F2"
      />
    </div>
  );
}

export function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<textarea className="mt-1 min-h-28 w-full rounded-xl bg-background px-3 py-2.5 text-base outline-none transition focus:ring-2 focus:ring-primary/20" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
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
    <div ref={rootRef} className="relative block text-sm font-medium">
      {label && <p>{label}</p>}
      <button
        type="button"
        className={cn(
          "mt-1 flex w-full items-center justify-between gap-3 rounded-xl bg-background px-3 py-2.5 text-left text-base font-normal outline-none transition",
          open ? "ring-2 ring-primary/20" : "hover:bg-muted",
        )}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition", open ? "rotate-90" : "rotate-0")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl bg-background p-2 shadow-sm">
          {options.length === 0 ? (
            <div className="rounded-xl px-4 py-3 text-sm text-muted-foreground">없음</div>
          ) : (
            options.map(([optionValue, labelText]) => {
              const selected = optionValue === value;
              return (
                <button
                  key={optionValue}
                  type="button"
                  className={cn("flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition", selected ? "bg-primary/18 text-foreground" : "hover:bg-muted")}
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
  return <section className={cn("relative min-w-0 rounded-3xl bg-card p-4 sm:p-5", className)}><h3 className="mb-3 text-lg font-semibold tracking-tight">{title}</h3>{children}</section>;
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
    <div className="relative overflow-hidden rounded-2xl">
      <div
        className="absolute inset-y-0 right-0 flex w-[132px] overflow-hidden rounded-r-xl transition-opacity duration-150"
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

export function DataList({ title, items }: { title: string; items: Array<{ id: string; title: string; meta: string }> }) {
  return <Panel title={title}><div className="divide-y divide-border">{items.length === 0 && <p className="text-sm text-muted-foreground">표시할 항목이 없습니다.</p>}{items.map((item) => <div key={item.id} className="py-3 first:pt-0 last:pb-0"><p className="font-semibold">{item.title}</p><p className="mt-0.5 text-sm leading-6 text-muted-foreground">{item.meta}</p></div>)}</div></Panel>;
}

export function PrimaryButton({ children, onClick, disabled, icon, className }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; icon?: React.ReactNode; className?: string }) {
  return <button className={cn("flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-30", className)} onClick={onClick} disabled={disabled}>{icon}{children}</button>;
}

export function IconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return <button className="grid h-9 w-9 place-items-center rounded-full bg-background hover:bg-muted" onClick={onClick} aria-label={label}>{children}</button>;
}

export function segmentClass(active: boolean) {
  return cn("rounded-full px-3 py-2 text-sm font-medium transition", active ? "bg-primary text-primary-foreground" : "text-muted-foreground");
}

// 화면이 길어지는 곳을 나누는 알약 탭
export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: Array<readonly [T, string]>; value: T; onChange: (value: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn("flex flex-wrap gap-1.5", className)}>
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={cn("rounded-full px-3.5 py-2 text-sm font-medium transition", value === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
