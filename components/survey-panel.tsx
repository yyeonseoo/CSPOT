import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { getDateRange, makeLocalIso, minutesToTime, nowIso, timeToMinutes, today } from "@/lib/format";
import { getRequestAvailability, getSurveyHeatmap, getSurveyRecommendations, getSurveyTimes, slotKey } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AmbiguousTime, AppData, AvailabilityResponse, ClubUser, PracticeCandidate, ScheduleSurvey } from "@/types/domain";
import { Field, Panel, PrimaryButton, Select, TextArea } from "@/components/ui";

export function SurveyPanel({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const leaderSongs = data.songs.filter((song) => song.leaderUserId === currentUser.id);
  const memberSongIds = data.songMembers.filter((member) => member.userId === currentUser.id).map((member) => member.songId);
  const openSurveys = data.surveys.filter((survey) => survey.status === "OPEN" && memberSongIds.includes(survey.songId));
  const leaderSurveys = data.surveys.filter((survey) => leaderSongs.some((song) => song.id === survey.songId));
  const activeLeaderSurveys = leaderSurveys.filter((survey) => survey.status === "OPEN");
  const [form, setForm] = useState({ songId: leaderSongs[0]?.id ?? "", startDate: today(), endDate: today(), timeStart: "18:00", timeEnd: "22:00" });
  const [selectedSurveyId, setSelectedSurveyId] = useState(openSurveys[0]?.id ?? "");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [dragMode, setDragMode] = useState<"select" | "erase" | null>(null);
  const [ambiguousMemo, setAmbiguousMemo] = useState("");
  const [showActiveSurveys, setShowActiveSurveys] = useState(false);
  const [selectedLeaderSurveyId, setSelectedLeaderSurveyId] = useState("");
  const selectedSurvey = openSurveys.find((survey) => survey.id === selectedSurveyId) ?? openSurveys[0] ?? null;
  const selectedLeaderSurvey = activeLeaderSurveys.find((survey) => survey.id === selectedLeaderSurveyId) ?? activeLeaderSurveys[0] ?? null;
  const selectedSurveyDates = selectedSurvey ? getDateRange(selectedSurvey.startDate, selectedSurvey.endDate) : [];
  const selectedSurveyTimes = selectedSurvey ? getSurveyTimes(selectedSurvey) : [];

  useEffect(() => {
    if (!selectedSurveyId && openSurveys[0]) {
      setSelectedSurveyId(openSurveys[0].id);
    }
  }, [openSurveys, selectedSurveyId]);

  useEffect(() => {
    if (!selectedSurveyId) return;
    const saved = data.availabilityResponses.find((response) => response.surveyId === selectedSurveyId && response.userId === currentUser.id);
    setSelectedSlots(new Set(saved?.slots.filter((slot) => slot.available).map((slot) => slotKey(slot.date, slot.time)) ?? []));
  }, [currentUser.id, data.availabilityResponses, selectedSurveyId]);

  function addSurvey() {
    const song = data.songs.find((item) => item.id === form.songId);
    if (!song || song.leaderUserId !== currentUser.id) return;
    const createdAt = nowIso();
    const survey: ScheduleSurvey = { id: uid("survey"), performanceId: song.performanceId, songId: song.id, createdBy: currentUser.id, title: `${song.title} 일정 조사`, startDate: form.startDate, endDate: form.endDate, timeStart: form.timeStart, timeEnd: form.timeEnd, slotMinutes: 30, status: "OPEN", createdAt, updatedAt: createdAt };
    persist({ ...data, surveys: [...data.surveys, survey] });
  }

  function toggleSlot(date: string, time: string, forcedMode?: "select" | "erase") {
    const key = slotKey(date, time);
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      const mode = forcedMode ?? (next.has(key) ? "erase" : "select");
      if (mode === "erase") next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function submitResponse() {
    if (!selectedSurvey) return;
    const submittedAt = nowIso();
    const slots = selectedSurveyDates.flatMap((date) => selectedSurveyTimes.map((time) => ({ date, time, available: selectedSlots.has(slotKey(date, time)) })));
    const availability: AvailabilityResponse = { id: uid("availability"), surveyId: selectedSurvey.id, userId: currentUser.id, slots, submittedAt, updatedAt: submittedAt };
    const ambiguous: AmbiguousTime | null = ambiguousMemo.trim() ? { id: uid("ambiguous"), surveyId: selectedSurvey.id, userId: currentUser.id, date: selectedSurvey.startDate, timeStart: selectedSurvey.timeStart, timeEnd: selectedSurvey.timeEnd, memo: ambiguousMemo, createdAt: submittedAt } : null;
    persist({ ...data, availabilityResponses: [...data.availabilityResponses.filter((item) => !(item.surveyId === selectedSurvey.id && item.userId === currentUser.id)), availability], ambiguousTimes: ambiguous ? [...data.ambiguousTimes, ambiguous] : data.ambiguousTimes });
    setAmbiguousMemo("");
  }

  function createRecommendedCandidate(survey: ScheduleSurvey, recommendation: { date: string; start: string; end: string; count: number; total: number }) {
    const song = data.songs.find((item) => item.id === survey.songId);
    if (!song || song.leaderUserId !== currentUser.id) return false;
    const createdAt = nowIso();
    const startsAt = makeLocalIso(recommendation.date, recommendation.start);
    const endsAt = makeLocalIso(recommendation.date, recommendation.end);
    const duplicate = data.practiceCandidates.some((candidate) =>
      candidate.songId === song.id
      && candidate.startsAt === startsAt
      && candidate.endsAt === endsAt
      && candidate.status !== "REJECTED"
    );
    if (duplicate) return false;
    const candidate: PracticeCandidate = {
      id: uid("candidate"),
      performanceId: song.performanceId,
      songId: song.id,
      surveyId: survey.id,
      proposedBy: currentUser.id,
      title: `${song.title} 연습`,
      startsAt,
      endsAt,
      availableMemberCount: recommendation.count,
      totalMemberCount: recommendation.total,
      memo: `일정 조사 추천 후보 · ${recommendation.count}/${recommendation.total}명 가능`,
      status: "PENDING",
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, practiceCandidates: [...data.practiceCandidates, candidate] });
    return true;
  }

  return (
    <section className="space-y-5">
      {leaderSongs.length > 0 && (
        <Panel title="일정 조사 만들기">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Select label="팀장인 곡" value={form.songId} onChange={(value) => setForm({ ...form, songId: value })} options={leaderSongs.map((song) => [song.id, song.title])} />
              <Field label="시작 날짜" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
              <Field label="종료 날짜" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
              <Field label="시작 시간" type="time" value={form.timeStart} onChange={(value) => setForm({ ...form, timeStart: value })} />
              <Field label="종료 시간" type="time" value={form.timeEnd} onChange={(value) => setForm({ ...form, timeEnd: value })} />
              <div className="flex items-end"><PrimaryButton onClick={addSurvey}>조사 생성</PrimaryButton></div>
          </div>
        </Panel>
      )}
      {leaderSongs.length > 0 && (
        <>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-3xl border border-primary/15 bg-primary/10 px-5 py-4 text-left transition hover:bg-primary/15 disabled:cursor-default disabled:opacity-60"
            disabled={activeLeaderSurveys.length === 0}
            onClick={() => setShowActiveSurveys((value) => !value)}
          >
            <span>
              <span className="block text-base font-black">내가 만든 진행 중인 조사</span>
              <span className="mt-1 block text-xs font-bold text-muted-foreground">{activeLeaderSurveys.length > 0 ? `${activeLeaderSurveys.length}개` : "현재 진행 중인 조사가 없습니다"}</span>
            </span>
            {showActiveSurveys ? <ChevronUp className="text-primary" size={21} /> : <ChevronDown className="text-primary" size={21} />}
          </button>
          {showActiveSurveys && selectedLeaderSurvey && (
            <div className="space-y-4">
              <div className="rounded-3xl bg-primary/8 p-4">
                <Select
                  label="확인할 조사"
                  value={selectedLeaderSurvey.id}
                  onChange={setSelectedLeaderSurveyId}
                  options={activeLeaderSurveys.map((survey) => [survey.id, survey.title])}
                />
              </div>
              <SurveySummaryPanel data={data} surveys={[selectedLeaderSurvey]} onCreateCandidate={createRecommendedCandidate} />
            </div>
          )}
        </>
      )}
      <Panel title="조사 응답">
        {openSurveys.length === 0 || !selectedSurvey ? (
          <p className="text-sm text-muted-foreground">참여 중인 열린 조사가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            <Select label="참여 중인 조사" value={selectedSurvey.id} onChange={setSelectedSurveyId} options={openSurveys.map((survey) => [survey.id, survey.title])} />
            <AvailabilityGrid
              dates={selectedSurveyDates}
              times={selectedSurveyTimes}
              selectedSlots={selectedSlots}
              dragMode={dragMode}
              onDragMode={setDragMode}
              onToggleSlot={toggleSlot}
            />
            <TextArea label="애매한 시간 메모" value={ambiguousMemo} onChange={setAmbiguousMemo} />
            <PrimaryButton onClick={submitResponse}>응답 저장</PrimaryButton>
          </div>
        )}
      </Panel>
    </section>
  );
}

function AvailabilityGrid({
  dates,
  times,
  selectedSlots,
  dragMode,
  onDragMode,
  onToggleSlot,
}: {
  dates: string[];
  times: string[];
  selectedSlots: Set<string>;
  dragMode: "select" | "erase" | null;
  onDragMode: (mode: "select" | "erase" | null) => void;
  onToggleSlot: (date: string, time: string, forcedMode?: "select" | "erase") => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[1.6rem] bg-white/55 p-3 shadow-inner dark:bg-white/5" onMouseLeave={() => onDragMode(null)} onMouseUp={() => onDragMode(null)}>
      <div className="grid min-w-[680px] gap-1" style={{ gridTemplateColumns: `72px repeat(${dates.length}, minmax(72px, 1fr))` }}>
        <div />
        {dates.map((date) => (
          <div key={date} className="px-1 pb-2 text-center text-xs font-black text-muted-foreground">
            <span className="block text-foreground">{new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(new Date(`${date}T00:00:00`))}</span>
            {date.slice(5).replace("-", ".")}
          </div>
        ))}
        {times.map((time) => (
          <div key={time} className="contents">
            <div className="pr-2 text-right text-[11px] font-bold leading-7 text-muted-foreground">{time}</div>
            {dates.map((date) => {
              const active = selectedSlots.has(slotKey(date, time));
              return (
                <button
                  key={slotKey(date, time)}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "grid h-7 place-items-center rounded-xl border border-sky-200/70 text-[10px] font-black outline-none transition hover:ring-2 hover:ring-primary/25 focus-visible:ring-2 focus-visible:ring-primary/30",
                    active ? "bg-primary/80 text-white shadow-inner" : "bg-sky-50/80 text-slate-400 dark:bg-white/10 dark:text-slate-300",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const mode = active ? "erase" : "select";
                    onDragMode(mode);
                    onToggleSlot(date, time, mode);
                  }}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    const mode = active ? "erase" : "select";
                    onDragMode(mode);
                    onToggleSlot(date, time, mode);
                  }}
                  onMouseEnter={() => {
                    if (dragMode) onToggleSlot(date, time, dragMode);
                  }}
                >
                  {time}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SurveySummaryPanel({ data, surveys, onCreateCandidate }: { data: AppData; surveys: ScheduleSurvey[]; onCreateCandidate: (survey: ScheduleSurvey, recommendation: { date: string; start: string; end: string; count: number; total: number }) => boolean }) {
  const [recommendationLimits, setRecommendationLimits] = useState<Record<string, number>>({});
  const [requestDrafts, setRequestDrafts] = useState<Record<string, { date: string; start: string; end: string }>>({});
  const [requestMessages, setRequestMessages] = useState<Record<string, string>>({});

  return (
    <Panel title="조사 결과">
      <div className="space-y-5">
        {surveys.length === 0 && <p className="text-sm leading-6 text-muted-foreground">팀장으로 만든 조사가 있으면 응답 분포와 추천 연습시간이 표시됩니다.</p>}
        {surveys.map((survey) => {
          const dates = getDateRange(survey.startDate, survey.endDate);
          const times = getSurveyTimes(survey);
          const { counts, totalResponses } = getSurveyHeatmap(survey, data);
          const recommendations = getSurveyRecommendations(survey, data);
          const recommendationLimit = recommendationLimits[survey.id] ?? 6;
          const visibleRecommendations = recommendations.slice(0, recommendationLimit);
          const defaultEnd = minutesToTime(Math.min(timeToMinutes(survey.timeEnd), timeToMinutes(survey.timeStart) + 60));
          const requestDraft = requestDrafts[survey.id] ?? { date: survey.startDate, start: survey.timeStart, end: defaultEnd };
          const endOptions = [...times.filter((time) => time > requestDraft.start), survey.timeEnd].filter((time, index, values) => values.indexOf(time) === index);
          const requestAvailability = getRequestAvailability(survey, data, requestDraft.date, requestDraft.start, requestDraft.end);
          const setRequestDraft = (partial: Partial<typeof requestDraft>) => {
            setRequestDrafts((drafts) => ({ ...drafts, [survey.id]: { ...requestDraft, ...partial } }));
            setRequestMessages((messages) => ({ ...messages, [survey.id]: "" }));
          };
          return (
            <div key={survey.id} className="rounded-3xl bg-muted/45 p-4">
              <p className="font-black">{survey.title}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{survey.startDate} - {survey.endDate} · 응답 {totalResponses}명</p>
              <div className="mt-3 overflow-x-auto rounded-[1.35rem] bg-white/55 p-2 shadow-inner dark:bg-white/5">
                <div className="grid min-w-[560px] gap-1" style={{ gridTemplateColumns: `56px repeat(${dates.length}, minmax(74px, 1fr))` }}>
                  <div />
                  {dates.map((date) => <div key={date} className="pb-1 text-center text-[10px] font-black text-muted-foreground">{date.slice(5).replace("-", ".")}</div>)}
                  {times.map((time) => (
                    <div key={time} className="contents">
                      <div className="pr-1 text-right text-[10px] font-bold leading-6 text-muted-foreground">{time}</div>
                      {dates.map((date) => {
                        const count = counts.get(slotKey(date, time)) ?? 0;
                        const intensity = totalResponses === 0 ? 0 : count / totalResponses;
                        return (
                          <div
                            key={slotKey(date, time)}
                            className="grid h-7 grid-cols-[1fr_auto] items-center rounded-xl border border-sky-200/70 px-2 text-[10px] font-black"
                            style={{ backgroundColor: `hsl(199 82% ${94 - intensity * 34}%)`, color: intensity > 0.55 ? "white" : "#334155" }}
                          >
                            <span className={cn("truncate", count ? "" : "opacity-45")}>{time}</span>
                            <span>{count || ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-2xl border border-primary/15 bg-primary/8 p-3">
                  <p className="mb-3 text-sm font-black">승인 요청 시간</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <Select label="날짜" value={requestDraft.date} onChange={(date) => setRequestDraft({ date })} options={dates.map((date) => [date, date])} />
                    <Select
                      label="시작"
                      value={requestDraft.start}
                      onChange={(start) => {
                        const nextEnd = timeToMinutes(requestDraft.end) > timeToMinutes(start)
                          ? requestDraft.end
                          : minutesToTime(Math.min(timeToMinutes(survey.timeEnd), timeToMinutes(start) + survey.slotMinutes));
                        setRequestDraft({ start, end: nextEnd });
                      }}
                      options={times.map((time) => [time, time])}
                    />
                    <Select label="종료" value={requestDraft.end} onChange={(end) => setRequestDraft({ end })} options={endOptions.map((time) => [time, time])} />
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-black text-muted-foreground">현재 응답 기준 {requestAvailability.count}/{requestAvailability.total}명 가능</p>
                    <button
                      type="button"
                      className="rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-sm"
                      onClick={() => {
                        const created = onCreateCandidate(survey, { ...requestDraft, ...requestAvailability });
                        setRequestMessages((messages) => ({ ...messages, [survey.id]: created ? "승인 요청을 보냈습니다." : "같은 시간의 대기 또는 승인 요청이 이미 있습니다." }));
                      }}
                    >
                      승인 요청 보내기
                    </button>
                  </div>
                  {requestMessages[survey.id] && <p className="mt-2 text-xs font-black text-primary">{requestMessages[survey.id]}</p>}
                </div>
                <p className="pt-2 text-xs font-black text-muted-foreground">추천 시간</p>
                <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/45 px-3 py-2 text-xs font-black">
                  <span>추천 개수</span>
                  <input
                    className="w-20 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-right outline-none focus:ring-4 focus:ring-primary/15"
                    type="number"
                    min={1}
                    max={20}
                    value={recommendationLimit}
                    onChange={(event) => {
                      const next = Math.min(20, Math.max(1, Number(event.target.value) || 1));
                      setRecommendationLimits((prev) => ({ ...prev, [survey.id]: next }));
                    }}
                  />
                </label>
                {recommendations.length === 0 && <p className="text-xs font-bold text-muted-foreground">아직 추천할 수 있는 시간이 없습니다.</p>}
                {visibleRecommendations.map((item) => (
                  <button
                    key={`${survey.id}-${item.date}-${item.start}`}
                    type="button"
                    className={cn("flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm font-bold transition", requestDraft.date === item.date && requestDraft.start === item.start && requestDraft.end === item.end ? "bg-primary/15 ring-1 ring-primary/30" : "bg-white/65 hover:bg-white")}
                    onClick={() => setRequestDraft({ date: item.date, start: item.start, end: item.end })}
                  >
                    <span>{item.date} {item.start}-{item.end}</span>
                    <span className="rounded-full bg-primary/20 px-2 py-1 text-xs text-primary">{item.count}/{item.total}명</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
