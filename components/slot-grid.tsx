import { useRef } from "react";
import { availabilitySegments, getAvailableUserIds, slotKey } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { AppData, ScheduleSurvey } from "@/types/domain";
import { Field, Select } from "@/components/ui";

const presetLocations = ["수련관", "외부 대관"];

function weekday(date: string) {
  return new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(`${date}T00:00:00`));
}

export function formatSlotDate(date: string) {
  return `${date.slice(5).replace("-", ".")} (${weekday(date)})`;
}

// 날짜(열) × 시간(행) 표. 행 사이 간격을 최소로 붙여서 하루 전체도 한 화면에 들어오게 한다.
export function SlotGrid({ dates, times, cell, rowHeight = "minmax(16px, auto)", gridProps }: { dates: string[]; times: string[]; cell: (date: string, time: string) => React.ReactNode; rowHeight?: string; gridProps?: React.HTMLAttributes<HTMLDivElement> }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <div
        {...gridProps}
        className={cn("grid gap-x-1", gridProps?.className)}
        style={{ minWidth: 26 + dates.length * 38, gridTemplateColumns: `24px repeat(${dates.length}, minmax(34px, 1fr))`, gridTemplateRows: "auto", gridAutoRows: rowHeight, ...gridProps?.style }}
      >
        <div />
        {dates.map((date) => (
          <div key={date} className="pb-2 text-center leading-tight">
            <span className="block text-[11px] font-medium text-muted-foreground">{weekday(date)}</span>
            <span className="text-sm font-semibold">{Number(date.slice(8))}</span>
          </div>
        ))}
        {times.map((time, index) => {
          const onHour = time.endsWith(":00");
          return (
            <div key={time} className="contents">
              <div className="relative">
                {onHour && <span className="absolute right-1 top-0 -translate-y-1/2 text-[10px] font-medium leading-none text-muted-foreground tabular-nums">{Number(time.slice(0, 2))}</span>}
              </div>
              {dates.map((date) => (
                <div
                  key={slotKey(date, time)}
                  className={cn("min-w-0 overflow-hidden", onHour && index > 0 ? "pt-0.5" : "pt-px", index === 0 && "rounded-t-lg", index === times.length - 1 && "rounded-b-lg")}
                >
                  {cell(date, time)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 드래그로 칸을 고르는 표. counts를 주면 가능 인원 수를 색 농도와 숫자로 같이 보여준다.
export function AvailabilityGrid({
  dates,
  times,
  selected,
  onChange,
  counts,
  total = 0,
  disabled = false,
}: {
  dates: string[];
  times: string[];
  selected: Set<string>;
  onChange: (update: (prev: Set<string>) => Set<string>) => void;
  counts?: Map<string, number>;
  total?: number;
  disabled?: boolean;
}) {
  const dragMode = useRef<"select" | "erase" | null>(null);

  function apply(key: string, mode: "select" | "erase") {
    onChange((prev) => {
      if (prev.has(key) === (mode === "select")) return prev;
      const next = new Set(prev);
      if (mode === "erase") next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 터치는 처음 누른 칸에 포인터가 묶이므로 좌표로 현재 칸을 찾는다.
  const keyAt = (event: React.PointerEvent) => (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.dataset.slot;
  const endDrag = () => { dragMode.current = null; };

  return (
    <SlotGrid
      dates={dates}
      times={times}
      // 하루 전체(48칸)도 화면 높이 안에 들어오도록 칸 높이를 줄인다.
      rowHeight={`clamp(10px, calc((100dvh - 240px) / ${times.length}), 26px)`}
      gridProps={{
        className: "select-none",
        // 세로 드래그는 칠하기, 가로 밀기는 날짜 스크롤
        style: { touchAction: "pan-x" },
        onPointerDown: (event) => {
          const key = keyAt(event);
          if (!key || disabled) return;
          event.preventDefault();
          dragMode.current = selected.has(key) ? "erase" : "select";
          apply(key, dragMode.current);
        },
        onPointerMove: (event) => {
          const key = dragMode.current && keyAt(event);
          if (key && dragMode.current) apply(key, dragMode.current);
        },
        onPointerUp: endDrag,
        onPointerCancel: endDrag,
        onPointerLeave: endDrag,
      }}
      cell={(date, time) => {
        const key = slotKey(date, time);
        const active = selected.has(key);
        const count = counts?.get(key) ?? 0;
        const intensity = total === 0 ? 0 : count / total;
        return (
          <button
            type="button"
            data-slot={key}
            aria-pressed={active}
            aria-label={`${formatSlotDate(date)} ${time}${counts ? ` 가능 ${count}명` : ""}`}
            disabled={disabled}
            className={cn(
              "block h-full w-full text-[9px] font-semibold leading-none text-neutral-800 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary disabled:cursor-default",
              active ? "bg-primary text-primary-foreground" : "bg-background",
            )}
            style={counts && !active && intensity ? { backgroundColor: `hsl(95 72% ${90 - intensity * 30}%)`, color: "#171717" } : undefined}
            // 포인터 입력은 표에서 처리하고, 키보드(Enter/Space)만 여기서 처리한다.
            onClick={(event) => { if (event.detail === 0) apply(key, active ? "erase" : "select"); }}
          >
            {counts ? count || "" : ""}
          </button>
        );
      }}
    />
  );
}

// 연습 시간 동안 누가 가능한지. 시간대별로 가능한 사람이 바뀌면 구간별로 나눠 보여준다.
export function AvailabilityBreakdown({ survey, data, memberIds, date, times }: { survey: ScheduleSurvey; data: AppData; memberIds: string[]; date: string; times: string[] }) {
  const names = (userIds: string[]) => userIds.map((userId) => data.users.find((user) => user.id === userId)?.name).filter(Boolean).join(", ");
  const allIds = getAvailableUserIds(survey, data, memberIds, date, times);
  const segments = availabilitySegments(survey, data, memberIds, date, times);
  return (
    <div className="space-y-2 rounded-xl bg-background p-3 text-sm">
      <p className="font-semibold">전체 시간 가능 {allIds.length}/{memberIds.length}명</p>
      {segments.length > 1 ? (
        segments.map((segment) => (
          <div key={segment.start} className="grid grid-cols-[104px_1fr] gap-2">
            <span className="font-medium tabular-nums">{segment.start}~{segment.end} <span className="text-foreground">{segment.userIds.length}명</span></span>
            <span className="text-muted-foreground">{names(segment.userIds) || "없음"}</span>
          </div>
        ))
      ) : (
        <>
          <p className="text-muted-foreground">{names(allIds) || "가능한 팀원 없음"}</p>
          {allIds.length < memberIds.length && <p className="text-xs text-muted-foreground">불가 또는 미응답: {names(memberIds.filter((userId) => !allIds.includes(userId)))}</p>}
        </>
      )}
    </div>
  );
}

export function LocationField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const custom = !presetLocations.includes(value);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Select label="희망 연습 장소" value={custom ? "기타" : value} onChange={(next) => onChange(next === "기타" ? "" : next)} options={[...presetLocations, "기타"].map((item) => [item, item])} />
      {custom && <Field label="기타 장소" value={value} placeholder="장소 입력" onChange={onChange} />}
    </div>
  );
}
