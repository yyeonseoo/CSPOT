import { ChevronLeft, Check, X } from "lucide-react";
import { useState } from "react";
import { getDateRange, makeLocalIso, minutesToTime, nowIso, timeToMinutes, today } from "@/lib/format";
import { candidateBlock, findPracticeConflicts, isPastPerformance, getSongUserIds, slotKey, slotsCovering, surveyLabel, surveyUserIds, timesBetween } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, PracticeCandidate, Schedule, ScheduleSurvey } from "@/types/domain";
import { describeConflict, DayTimeline, RequestGrid, songTitleOf, surveyRequests } from "@/components/practice-overview";
import { AvailabilityBreakdown, formatSlotDate, LocationField } from "@/components/slot-grid";
import { Field, Panel, PrimaryButton, Select, SoftCheckbox, Tabs } from "@/components/ui";

const hours = Array.from({ length: 25 }, (_, hour) => `${String(hour).padStart(2, "0")}:00`);
const statusLabels = { PENDING: "대기", APPROVED: "확정", REJECTED: "반려" };

type PanelProps = { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void };

function approveRequests(data: AppData, currentUser: ClubUser, items: PracticeCandidate[]): AppData {
  const updatedAt = nowIso();
  const approved = items.map((item) => ({ ...item, status: "APPROVED" as const, reviewedBy: currentUser.id, reviewedAt: updatedAt, updatedAt }));
  const byId = new Map(approved.map((item) => [item.id, item]));
  const schedules: Schedule[] = approved.flatMap((item) => {
    const song = data.songs.find((candidate) => candidate.id === item.songId);
    return song ? [{ id: uid("schedule"), type: "PRACTICE", title: `${song.title} 연습`, startsAt: item.startsAt, endsAt: item.endsAt, location: item.location, performanceId: song.performanceId, songId: song.id, candidateId: item.id, visibility: "MEMBERS_ONLY", status: "CONFIRMED", createdBy: currentUser.id, createdAt: updatedAt, updatedAt }] : [];
  });
  return {
    ...data,
    practiceCandidates: data.practiceCandidates.map((item) => byId.get(item.id) ?? item),
    schedules: [...data.schedules, ...schedules],
  };
}

export function SongManagementPanel({ data, currentUser, persist }: PanelProps) {
  const [surveyId, setSurveyId] = useState(data.surveys[data.surveys.length - 1]?.id ?? "");
  const survey = data.surveys.find((item) => item.id === surveyId) ?? data.surveys[data.surveys.length - 1];
  const [form, setForm] = useState({ title: "", startDate: today(), endDate: today(), timeStart: "18:00", timeEnd: "22:00", performanceIds: [] as string[] });
  const [showForm, setShowForm] = useState(false);
  // 수정 중인 조사 id. 비어 있으면 새 조사
  const [editingSurveyId, setEditingSurveyId] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [viewTab, setViewTab] = useState<"grid" | "day">("grid");
  const validForm = form.title.trim() !== "" && form.startDate <= form.endDate && form.timeStart < form.timeEnd && form.performanceIds.length > 0;
  const requests = survey ? surveyRequests(survey, data) : [];
  // 조사 대상으로 고를 수 있는 공연: 아직 끝나지 않은 공연만
  // 수정할 때 이미 골라둔 공연은 끝났어도 보여준다.
  const upcomingPerformances = data.performances.filter((performance) => !isPastPerformance(performance) || form.performanceIds.includes(performance.id));
  const conflictsById = new Map(requests.map((candidate) => [candidate.id, findPracticeConflicts(candidate, requests, data)]));
  const selected = requests.find((candidate) => candidate.id === selectedId);
  const requestsBySlot = new Map<string, PracticeCandidate[]>();
  if (survey) {
    for (const candidate of requests) {
      const block = candidateBlock(candidate);
      for (const time of slotsCovering(survey, block.start, block.end)) {
        const key = slotKey(block.date, time);
        requestsBySlot.set(key, [...(requestsBySlot.get(key) ?? []), candidate]);
      }
    }
  }
  const slotItems = selectedSlot ? requestsBySlot.get(selectedSlot) ?? [] : [];
  const sheetOpen = Boolean(selected || selectedSlot);

  function closeSheet() {
    setSelectedId("");
    setSelectedSlot("");
  }

  function openSurvey() {
    if (!validForm) return;
    if (editingSurveyId) {
      const updatedAt = nowIso();
      persist({
        ...data,
        surveys: data.surveys.map((item) => item.id === editingSurveyId ? { ...item, ...form, title: form.title.trim(), updatedAt } : item),
      });
      setEditingSurveyId("");
      setShowForm(false);
      setForm({ ...form, title: "", performanceIds: [] });
      return;
    }
    const createdAt = nowIso();
    const next: ScheduleSurvey = { id: uid("survey"), createdBy: currentUser.id, ...form, title: form.title.trim(), slotMinutes: 30, status: "OPEN", createdAt, updatedAt: createdAt };
    persist({ ...data, surveys: [...data.surveys, next] });
    setSurveyId(next.id);
    setShowForm(false);
    setForm({ ...form, title: "", performanceIds: [] });
    closeSheet();
  }

  function startEditSurvey() {
    if (!survey) return;
    setForm({ title: survey.title, startDate: survey.startDate, endDate: survey.endDate, timeStart: survey.timeStart, timeEnd: survey.timeEnd, performanceIds: survey.performanceIds });
    setEditingSurveyId(survey.id);
    setShowForm(true);
  }

  // 응답과 요청은 같이 지우고, 이미 확정된 연습 일정은 캘린더에 남긴다.
  function deleteSurvey() {
    if (!survey) return;
    if (!window.confirm(`"${survey.title}" 조사를 삭제할까요? 응답과 연습 요청이 함께 지워집니다. 이미 확정된 연습은 캘린더에 남습니다.`)) return;
    persist({
      ...data,
      surveys: data.surveys.filter((item) => item.id !== survey.id),
      availabilityResponses: data.availabilityResponses.filter((response) => response.surveyId !== survey.id),
      practiceCandidates: data.practiceCandidates.filter((candidate) => candidate.surveyId !== survey.id),
    });
    setSurveyId("");
    setEditingSurveyId("");
    setShowForm(false);
    closeSheet();
  }

  function toggleSurvey() {
    if (!survey) return;
    persist({ ...data, surveys: data.surveys.map((item) => item.id === survey.id ? { ...item, status: item.status === "OPEN" ? "CLOSED" : "OPEN", updatedAt: nowIso() } : item) });
  }

  const requestCard = (candidate: PracticeCandidate) => {
    const block = candidateBlock(candidate);
    const conflicts = conflictsById.get(candidate.id) ?? [];
    return (
      <button key={candidate.id} type="button" className={cn("w-full rounded-xl bg-background p-3 text-left", conflicts.length ? "" : "")} onClick={() => setSelectedId(candidate.id)}>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold">{songTitleOf(data, candidate.songId)}</p>
          <span className="flex shrink-0 gap-1">
            <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", candidate.status === "APPROVED" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{statusLabels[candidate.status]}</span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{formatSlotDate(block.date)} {block.start}~{block.end}, {candidate.location}</p>
        {conflicts.map((conflict) => <p key={conflict.other.id} className="mt-1 text-xs font-medium text-orange-600">{describeConflict(data, candidate, conflict)}</p>)}
      </button>
    );
  };

  const surveyForm = (
    <div className="space-y-2">
      <Field label="조사 제목" value={form.title} placeholder="예: 515DAY 1주차 연습" onChange={(value) => setForm({ ...form, title: value })} />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Field label="시작 날짜" type="date" value={form.startDate} onChange={(value) => setForm({ ...form, startDate: value })} />
        <Field label="종료 날짜" type="date" value={form.endDate} onChange={(value) => setForm({ ...form, endDate: value })} />
        <Select label="시작 시간" value={form.timeStart} onChange={(value) => setForm({ ...form, timeStart: value, timeEnd: form.timeEnd > value ? form.timeEnd : hours[hours.indexOf(value) + 1] })} options={hours.slice(0, 24).map((hour) => [hour, hour])} />
        <Select label="종료 시간" value={form.timeEnd} onChange={(value) => setForm({ ...form, timeEnd: value })} options={hours.filter((hour) => hour > form.timeStart).map((hour) => [hour, hour])} />
      </div>
      <button type="button" className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium" onClick={() => setForm({ ...form, timeStart: "00:00", timeEnd: "24:00" })}>하루 전체</button>
      <p className="pt-1 text-sm font-medium">조사 대상 공연</p>
      <div className="flex flex-wrap gap-2">
        {upcomingPerformances.length === 0 && <p className="text-sm text-muted-foreground">예정된 공연이 없습니다.</p>}
        {upcomingPerformances.map((performance) => (
          <SoftCheckbox
            key={performance.id}
            checked={form.performanceIds.includes(performance.id)}
            label={`${performance.title} ${surveyUserIds({ performanceIds: [performance.id] }, data).length}명`}
            onToggle={() => setForm({ ...form, performanceIds: form.performanceIds.includes(performance.id) ? form.performanceIds.filter((id) => id !== performance.id) : [...form.performanceIds, performance.id] })}
          />
        ))}
      </div>
      <PrimaryButton onClick={openSurvey} disabled={!validForm}>{editingSurveyId ? "수정 저장" : "조사 열기"}</PrimaryButton>
    </div>
  );

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-4">
        <Panel title="연습 일정 조사">
          {survey ? (
            <div className="space-y-2">
              {data.surveys.length > 1 && (
                <Select label="조사 선택" value={survey.id} onChange={(value) => { setSurveyId(value); closeSheet(); }} options={data.surveys.slice().reverse().map((item) => [item.id, surveyLabel(item)])} />
              )}
              <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
                <p className="min-w-0 text-sm font-semibold">
                  <span className={cn("mr-1.5 rounded-full px-2 py-0.5 text-xs", survey.status === "OPEN" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20")}>{survey.status === "OPEN" ? "진행 중" : "마감"}</span>
                  {survey.title}
                  <span className="block text-xs text-muted-foreground">
                    {survey.startDate.slice(5).replace("-", ".")}~{survey.endDate.slice(5).replace("-", ".")}, {survey.timeStart}~{survey.timeEnd}<br />응답 {data.availabilityResponses.filter((response) => response.surveyId === survey.id).length}/{surveyUserIds(survey, data).length}명
                  </span>
                  <span className="block text-xs text-muted-foreground">{survey.performanceIds.length ? data.performances.filter((performance) => survey.performanceIds.includes(performance.id)).map((performance) => performance.title).join(", ") : "전체 멤버"}</span>
                </p>
                <button type="button" className="shrink-0 rounded-xl bg-background px-3 py-2 text-sm font-semibold shadow-sm" onClick={toggleSurvey}>{survey.status === "OPEN" ? "마감" : "다시 열기"}</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="rounded-full bg-background px-4 py-2 text-sm font-medium" onClick={startEditSurvey}>조사 수정</button>
                <button type="button" className="rounded-full bg-background px-4 py-2 text-sm font-medium text-destructive" onClick={deleteSurvey}>조사 삭제</button>
              </div>
              <button type="button" className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium" onClick={() => { if (showForm) { setShowForm(false); setEditingSurveyId(""); setForm({ ...form, title: "", performanceIds: [] }); } else setShowForm(true); }}>{showForm ? "닫기" : "새 조사 열기"}</button>
              {showForm && surveyForm}
            </div>
          ) : surveyForm}
        </Panel>
        {survey && requests.length > 0 && <Tabs tabs={[["grid", "전체 표"], ["day", "날짜별"]]} value={viewTab} onChange={setViewTab} />}
        {survey && (requests.length === 0 || viewTab === "grid") && (
          <Panel title="팀별 희망 시간">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">받은 요청이 없습니다.</p>
            ) : (
              <RequestGrid survey={survey} data={data} requests={requests} selectedSlot={selectedSlot} onSelectSlot={(key) => { setSelectedSlot(key); setSelectedId(""); }} />
            )}
          </Panel>
        )}
        {survey && requests.length > 0 && viewTab === "day" && (
          <Panel title="날짜별 보기">
            <DayTimeline key={survey.id} survey={survey} data={data} requests={requests} selectedId={selectedId} onSelect={setSelectedId} />
          </Panel>
        )}
      </div>

      {/* 모바일에서는 선택한 칸/요청을 아래에서 올라오는 시트로 보여준다. */}
      {sheetOpen && <button type="button" aria-label="닫기" className="fixed inset-0 z-30 bg-black/30 xl:hidden" onClick={closeSheet} />}
      <aside className={cn(sheetOpen ? "fixed inset-x-0 bottom-0 z-40 max-h-[85dvh] overflow-y-auto rounded-t-2xl xl:static xl:max-h-none xl:overflow-visible" : "hidden xl:block")}>
        <Panel
          title={selected ? "확정하기" : selectedSlot ? `${formatSlotDate(selectedSlot.split("_")[0])} ${selectedSlot.split("_")[1]}` : "확정하기"}
          className="rounded-b-none xl:rounded-b-2xl"
        >
          {sheetOpen && <button type="button" aria-label="닫기" className="absolute right-4 top-4 rounded-full bg-muted p-2" onClick={closeSheet}><X size={18} /></button>}
          {survey && selected ? (
            <>
              {selectedSlot && (
                <button type="button" className="mb-3 flex items-center gap-1 text-sm font-medium text-muted-foreground" onClick={() => setSelectedId("")}>
                  <ChevronLeft size={16} />목록
                </button>
              )}
              <RequestReview key={selected.id} request={selected} requests={requests} survey={survey} data={data} currentUser={currentUser} persist={persist} />
            </>
          ) : selectedSlot ? (
            <div className="space-y-2">{slotItems.map(requestCard)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">표의 칸이나 요청을 선택하세요.</p>
          )}
        </Panel>
      </aside>
    </section>
  );
}

function RequestReview({ request, requests, survey, data, currentUser, persist }: PanelProps & { request: PracticeCandidate; requests: PracticeCandidate[]; survey: ScheduleSurvey }) {
  const song = data.songs.find((item) => item.id === request.songId);
  // 여러 팀이 한 시간대를 나눠 쓸 수 있게 10분 단위로 조정한다.
  const startOptions = timesBetween(survey.timeStart, survey.timeEnd, 10);
  const [edit, setEdit] = useState(() => ({ ...candidateBlock(request), location: request.location }));
  const endOptions = [...startOptions.filter((time) => time > edit.start), survey.timeEnd].filter((time, index, values) => values.indexOf(time) === index);
  const durationMinutes = timeToMinutes(edit.end) - timeToMinutes(edit.start);
  const memberIds = getSongUserIds(request.songId, data);
  const pending = request.status === "PENDING";
  const valid = edit.start < edit.end;
  const startsAt = makeLocalIso(edit.date, edit.start);
  const endsAt = makeLocalIso(edit.date, edit.end);
  const location = edit.location.trim() || "기타";
  // 관리자가 시간·장소를 고치면 그 기준으로 다시 충돌을 본다.
  const target = { ...request, startsAt, endsAt, location };
  const conflicts = findPracticeConflicts(target, requests, data);
  // 이걸 확정하면 겹치는 다른 팀에 남는 연습(확정 + 이 시간과 안 겹치는 후보) 수
  const remainingFor = (songId: string) => requests.filter((item) => item.songId === songId && (item.status === "APPROVED" || findPracticeConflicts(target, [item], data).length === 0)).length;

  // 캘린더 연습 일정을 지우고 요청을 다시 대기로 돌린다.
  function cancelApproval() {
    if (!window.confirm("확정을 취소할까요? 캘린더의 연습 일정이 지워지고 요청은 다시 대기로 돌아갑니다.")) return;
    const updatedAt = nowIso();
    const isSource = (schedule: Schedule) => schedule.candidateId === request.id || (!schedule.candidateId && schedule.songId === request.songId && schedule.startsAt === request.startsAt && schedule.endsAt === request.endsAt);
    persist({
      ...data,
      schedules: data.schedules.filter((schedule) => !(schedule.type === "PRACTICE" && isSource(schedule))),
      practiceCandidates: data.practiceCandidates.map((item) => item.id === request.id ? { ...item, status: "PENDING" as const, reviewedBy: undefined, reviewedAt: undefined, updatedAt } : item),
    });
  }

  function review(status: "APPROVED" | "REJECTED") {
    if (!song) return;
    if (status === "APPROVED" && conflicts.some((conflict) => conflict.other.status === "APPROVED") && !window.confirm("이미 확정된 연습과 겹칩니다. 그래도 확정할까요?")) return;
    if (status === "APPROVED") {
      persist(approveRequests(data, currentUser, [{ ...request, startsAt, endsAt, location }]));
      return;
    }
    const updatedAt = nowIso();
    const rejected: PracticeCandidate = { ...request, status, reviewedBy: currentUser.id, reviewedAt: updatedAt, updatedAt };
    persist({
      ...data,
      practiceCandidates: data.practiceCandidates.map((item) => item.id === request.id ? rejected : item),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-lg font-semibold">{song?.title ?? "삭제된 곡"}</p>
        <p className="text-sm font-medium text-muted-foreground">
          {data.performances.find((performance) => performance.id === request.performanceId)?.title ?? "공연 없음"}, 팀장 {data.users.find((user) => user.id === song?.leaderUserId)?.name ?? "미지정"}
        </p>
      </div>
      {pending ? (
        <>
          <Select label="날짜" value={edit.date} onChange={(date) => setEdit({ ...edit, date })} options={getDateRange(survey.startDate, survey.endDate).map((date) => [date, formatSlotDate(date)])} />
          <div className="grid grid-cols-2 gap-2">
            <Select
              label="시작"
              value={edit.start}
              onChange={(start) => setEdit({ ...edit, start, end: edit.end > start ? edit.end : minutesToTime(Math.min(timeToMinutes(survey.timeEnd), timeToMinutes(start) + 60)) })}
              options={startOptions.map((time) => [time, time])}
            />
            <Select label="종료" value={edit.end} onChange={(end) => setEdit({ ...edit, end })} options={endOptions.map((time) => [time, time])} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">연습 {Math.floor(durationMinutes / 60) ? `${Math.floor(durationMinutes / 60)}시간 ` : ""}{durationMinutes % 60 ? `${durationMinutes % 60}분` : ""}</p>
          <LocationField value={edit.location} onChange={(value) => setEdit({ ...edit, location: value })} />
        </>
      ) : (
        <p className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">확정됨: {formatSlotDate(edit.date)} {edit.start}~{edit.end}, {request.location}</p>
      )}
      {conflicts.length > 0 && (
        <div className="space-y-1 rounded-xl bg-orange-50 p-3 text-sm dark:bg-orange-500/10">
          <p className="font-semibold text-orange-700 dark:text-orange-300">겹치는 요청 {conflicts.length}건</p>
          {conflicts.map((conflict) => {
            const remaining = conflict.other.status === "PENDING" ? remainingFor(conflict.other.songId) : null;
            return (
              <p key={conflict.other.id} className="text-orange-700 dark:text-orange-300">
                {describeConflict(data, target, conflict)}
                {remaining !== null && (remaining === 0
                  ? <span className="block font-semibold text-red-600">확정하면 이 팀은 연습 0회</span>
                  : <span className="block font-medium">확정해도 다른 후보 {remaining}건</span>)}
              </p>
            );
          })}
        </div>
      )}
      <AvailabilityBreakdown survey={survey} data={data} memberIds={memberIds} date={edit.date} times={slotsCovering(survey, edit.start, edit.end)} />
      {!pending && (
        <button type="button" className="w-full rounded-full bg-background px-4 py-3 text-sm font-semibold text-destructive" onClick={cancelApproval}>확정 취소</button>
      )}
      {pending && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive" onClick={() => review("REJECTED")}>반려</button>
          <PrimaryButton onClick={() => review("APPROVED")} disabled={!valid} icon={<Check size={16} />}>확정</PrimaryButton>
        </div>
      )}
    </div>
  );
}
