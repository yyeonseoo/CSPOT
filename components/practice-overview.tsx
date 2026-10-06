import { useState } from "react";
import { getDateRange, timeToMinutes } from "@/lib/format";
import { candidateBlock, findPracticeConflicts, getAvailableUserIds, getSongUserIds, getSurveyTimes, slotKey, slotsCovering } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { AppData, PracticeCandidate, ScheduleSurvey } from "@/types/domain";
import { formatSlotDate, SlotGrid } from "@/components/slot-grid";

// 관리자 조율 화면과 곡팀장의 겹침 현황(읽기 전용)이 같이 쓰는 표들.

export type Conflict = ReturnType<typeof findPracticeConflicts>[number];

export function songTitleOf(data: AppData, songId: string) {
  return data.songs.find((song) => song.id === songId)?.title ?? "삭제된 곡";
}

export function surveyRequests(survey: ScheduleSurvey, data: AppData) {
  return data.practiceCandidates.filter((candidate) => candidate.surveyId === survey.id && candidate.status !== "REJECTED").sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// 요청 전체 시간 중 실제로 겹치는 구간을 같이 적는다. 표의 한 칸에서는 안 겹쳐도 요청의 다른 시간에서 겹칠 수 있다.
export function describeConflict(data: AppData, target: PracticeCandidate, conflict: Conflict) {
  const names = conflict.sharedUserIds.map((userId) => data.users.find((user) => user.id === userId)?.name).filter(Boolean).join(", ");
  const reasons = [conflict.sameLocation && `둘 다 ${conflict.other.location}`, names && `${names} 두 곡 모두 참여`].filter(Boolean).join(", ");
  const overlap = candidateBlock({
    ...target,
    startsAt: target.startsAt > conflict.other.startsAt ? target.startsAt : conflict.other.startsAt,
    endsAt: target.endsAt < conflict.other.endsAt ? target.endsAt : conflict.other.endsAt,
  });
  return `${songTitleOf(data, conflict.other.songId)}${conflict.other.status === "APPROVED" ? "(확정)" : ""} ${overlap.start}~${overlap.end} (${reasons})`;
}

// 조사 기간 전체 표: 칸마다 요청한 팀 수. onSelectSlot이 없으면 보기 전용.
export function RequestGrid({ survey, data, requests, selectedSlot, onSelectSlot }: { survey: ScheduleSurvey; data: AppData; requests: PracticeCandidate[]; selectedSlot?: string; onSelectSlot?: (key: string) => void }) {
  const conflictsById = new Map(requests.map((candidate) => [candidate.id, findPracticeConflicts(candidate, requests, data)]));
  const requestsBySlot = new Map<string, PracticeCandidate[]>();
  for (const candidate of requests) {
    const block = candidateBlock(candidate);
    for (const time of slotsCovering(survey, block.start, block.end)) {
      const key = slotKey(block.date, time);
      requestsBySlot.set(key, [...(requestsBySlot.get(key) ?? []), candidate]);
    }
  }
  const times = getSurveyTimes(survey);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#6FE3F2]" />요청</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#FFB061]" />겹침</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary" />확정</span>
        <span>숫자 = 팀 수</span>
      </div>
      <SlotGrid
        dates={getDateRange(survey.startDate, survey.endDate)}
        times={times}
        rowHeight={`clamp(12px, calc((100dvh - 260px) / ${times.length}), 26px)`}
        cell={(date, time) => {
          const key = slotKey(date, time);
          const items = requestsBySlot.get(key) ?? [];
          const conflict = items.some((candidate) => conflictsById.get(candidate.id)?.some((item) => items.includes(item.other)));
          const allApproved = items.length > 0 && items.every((candidate) => candidate.status === "APPROVED");
          return (
            <button
              type="button"
              disabled={items.length === 0 || !onSelectSlot}
              aria-label={`${formatSlotDate(date)} ${time} 요청 ${items.length}팀`}
              className={cn(
                "block h-full w-full text-[10px] font-semibold leading-none disabled:cursor-default",
                items.length === 0 ? "bg-background" : conflict ? "bg-[#FFB061] text-neutral-900" : allApproved ? "bg-primary text-primary-foreground" : "bg-[#6FE3F2] text-neutral-800",
                selectedSlot === key && "ring-2 ring-inset ring-foreground",
              )}
              onClick={() => onSelectSlot?.(key)}
            >
              {items.length || ""}
            </button>
          );
        }}
      />
    </div>
  );
}

// 하루 타임라인: 가로 = 그날 요청한 곡, 세로 = 시간(1분 = 1px).
// 곡 칸 바탕은 그 곡 팀원 중 가능한 인원 비율(진할수록 많음)이라, 요청을 옮길 만한 시간을 같이 볼 수 있다.
// onSelect가 없으면 보기 전용. highlightSongIds는 곡팀장 화면에서 내 곡 표시용.
export function DayTimeline({ survey, data, requests, selectedId, onSelect, highlightSongIds = [] }: {
  survey: ScheduleSurvey;
  data: AppData;
  requests: PracticeCandidate[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  highlightSongIds?: string[];
}) {
  const dates = getDateRange(survey.startDate, survey.endDate);
  const onDate = (date: string) => requests.filter((request) => candidateBlock(request).date === date);
  const [date, setDate] = useState(() => dates.find((item) => onDate(item).length > 0) ?? dates[0]);
  const dayRequests = onDate(date);
  const songIds = Array.from(new Set(dayRequests.map((request) => request.songId))).sort((a, b) => Number(highlightSongIds.includes(b)) - Number(highlightSongIds.includes(a)) || songTitleOf(data, a).localeCompare(songTitleOf(data, b), "ko", { numeric: true }));
  const blocks = dayRequests.map((request) => ({ request, ...candidateBlock(request) }));
  // 요청이 있는 시간 앞뒤로 1시간씩 더 보여준다 (조사 범위 안에서).
  const from = Math.max(timeToMinutes(survey.timeStart), Math.floor(Math.min(...blocks.map((block) => timeToMinutes(block.start))) / 60) * 60 - 60);
  const to = Math.min(timeToMinutes(survey.timeEnd), Math.ceil(Math.max(...blocks.map((block) => timeToMinutes(block.end))) / 60) * 60 + 60);
  const hourMarks = Array.from({ length: Math.floor((to - from) / 60) + 1 }, (_, index) => from + index * 60).filter((minute) => minute <= to);
  const slots = getSurveyTimes(survey).filter((time) => timeToMinutes(time) >= from && timeToMinutes(time) < to);

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {dates.map((item) => {
          const count = new Set(onDate(item).map((request) => request.songId)).size;
          return (
            <button key={item} type="button" className={cn("shrink-0 rounded-xl px-3 py-2 text-left text-xs font-semibold", item === date ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")} onClick={() => setDate(item)}>
              {formatSlotDate(item)}
              <span className="block font-medium opacity-80">{count ? `${count}팀` : "없음"}</span>
            </button>
          );
        })}
      </div>
      {songIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">이 날짜에 들어온 요청이 없습니다.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <div className="grid gap-x-1" style={{ minWidth: 36 + songIds.length * 76, gridTemplateColumns: `32px repeat(${songIds.length}, minmax(72px, 1fr))` }}>
            <div />
            {songIds.map((songId) => (
              <p key={songId} className={cn("truncate pb-2 text-center text-xs font-semibold", highlightSongIds.includes(songId) && "underline underline-offset-4")} title={songTitleOf(data, songId)}>
                {highlightSongIds.includes(songId) && "★ "}{songTitleOf(data, songId)}
              </p>
            ))}
            <div className="relative" style={{ height: to - from }}>
              {hourMarks.map((minute) => (
                <span key={minute} className="absolute right-1 -translate-y-1/2 text-[10px] font-medium text-muted-foreground tabular-nums" style={{ top: minute - from }}>{minute / 60}</span>
              ))}
            </div>
            {songIds.map((songId) => {
              const memberIds = getSongUserIds(songId, data);
              return (
                <div key={songId} className="relative overflow-hidden rounded-xl bg-slate-100" style={{ height: to - from }}>
                  {slots.map((time) => {
                    const available = getAvailableUserIds(survey, data, memberIds, date, [time]).length;
                    const ratio = memberIds.length ? available / memberIds.length : 0;
                    return <div key={time} className="absolute inset-x-0" title={`${time} 가능 ${available}/${memberIds.length}명`} style={{ top: timeToMinutes(time) - from, height: survey.slotMinutes, backgroundColor: ratio ? `hsl(95 72% ${92 - ratio * 26}%)` : undefined }} />;
                  })}
                  {hourMarks.map((minute) => <div key={minute} className="absolute inset-x-0 border-t" style={{ top: minute - from }} />)}
                  {blocks.filter((block) => block.request.songId === songId).map((block) => {
                    const approved = block.request.status === "APPROVED";
                    const conflict = findPracticeConflicts(block.request, requests, data).length > 0;
                    return (
                      <button
                        key={block.request.id}
                        type="button"
                        disabled={!onSelect}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden rounded-xl px-1.5 py-1 text-left text-[11px] font-semibold leading-tight shadow-sm disabled:cursor-default",
                          approved ? "bg-primary text-primary-foreground" : conflict ? "bg-[#FFB061] text-neutral-900" : "bg-background text-foreground",
                          selectedId === block.request.id && "ring-2 ring-foreground",
                        )}
                        style={{ top: timeToMinutes(block.start) - from, height: timeToMinutes(block.end) - timeToMinutes(block.start) }}
                        onClick={() => onSelect?.(block.request.id)}
                      >
                        <span className="block tabular-nums">{block.start}~</span>
                        <span className="block tabular-nums">{block.end}</span>
                        <span className="block truncate font-medium opacity-90">{block.request.location}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
