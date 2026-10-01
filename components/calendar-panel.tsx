import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarDays, minutesToTime, monthTitle, nowIso, sameDay, timeOptions, timeToMinutes, toDateKey, toDatetimeLocal, today } from "@/lib/format";
import { eventColor, getVisibleSchedules, personalColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, Schedule, PracticeCandidate } from "@/types/domain";
import { CalendarEventPill, NoticeCard, ScheduleRow } from "@/components/items";
import { ColorDots, DateTimeField, Field, IconButton, Panel, PrimaryButton, Select, Tabs } from "@/components/ui";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

export function CalendarPanel({ data, currentUser, adminMode, persist }: { data: AppData; currentUser: ClubUser; adminMode: boolean; persist: (data: AppData) => void }) {
  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(today());
  const [calTab, setCalTab] = useState<"calendar" | "upcoming" | "notice">("calendar");
  const [showCreate, setShowCreate] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ title: "", startsAt: "", endsAt: "", color: "" });
  const [personalTitle, setPersonalTitle] = useState("");
  const [personalStart, setPersonalStart] = useState("18:00");
  const [personalEnd, setPersonalEnd] = useState("19:00");
  const [personalColorPick, setPersonalColorPick] = useState(personalColor);
  const visibleSchedules = useMemo(() => getVisibleSchedules(data, currentUser, adminMode), [adminMode, currentUser, data]);
  const monthDays = calendarDays(month);
  const selectedEvents = visibleSchedules.filter((schedule) => toDateKey(new Date(schedule.startsAt)) === selectedDate);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const nowKey = nowIso();
  const upcomingAll = visibleSchedules.filter((schedule) => schedule.endsAt >= nowKey).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const upcoming = showAllUpcoming ? upcomingAll : upcomingAll.slice(0, 5);
  const pinned = data.notices.filter((notice) => notice.pinned);

  function addPersonalSchedule() {
    if (!personalTitle.trim() || personalEnd <= personalStart) return;
    const createdAt = nowIso();
    const schedule: Schedule = {
      id: uid("schedule"),
      type: "PERSONAL",
      title: personalTitle,
      startsAt: new Date(`${selectedDate}T${personalStart}`).toISOString(),
      endsAt: new Date(`${selectedDate}T${personalEnd}`).toISOString(),
      color: personalColorPick,
      ownerUserId: currentUser.id,
      visibility: "PRIVATE",
      status: "CONFIRMED",
      createdBy: currentUser.id,
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, schedules: [...data.schedules, schedule] });
    setPersonalTitle("");
    setShowCreate(false);
  }

  function startEditSchedule(schedule: Schedule) {
    setEditingScheduleId(schedule.id);
    setScheduleForm({ title: schedule.title, startsAt: toDatetimeLocal(schedule.startsAt), endsAt: toDatetimeLocal(schedule.endsAt), color: schedule.type === "PERSONAL" ? eventColor(schedule, data, currentUser) : "" });
    setShowCreate(false);
  }

  function saveScheduleEdit() {
    if (!editingScheduleId || !scheduleForm.title.trim() || !scheduleForm.startsAt || !scheduleForm.endsAt || scheduleForm.startsAt >= scheduleForm.endsAt) return;
    const updatedAt = nowIso();
    const startsAt = new Date(scheduleForm.startsAt).toISOString();
    const endsAt = new Date(scheduleForm.endsAt).toISOString();
    const edited = data.schedules.find((schedule) => schedule.id === editingScheduleId);
    persist({
      ...data,
      schedules: data.schedules.map((schedule) => schedule.id === editingScheduleId ? { ...schedule, title: scheduleForm.title, startsAt, endsAt, ...(scheduleForm.color && { color: scheduleForm.color }), updatedAt } : schedule),
      // 확정된 연습이면 원래 요청 시간도 같이 옮겨서 관리자 화면과 맞춘다.
      practiceCandidates: data.practiceCandidates.map((candidate) => edited?.candidateId === candidate.id ? { ...candidate, startsAt, endsAt, updatedAt } : candidate),
    });
    setEditingScheduleId(null);
  }

  function cancelSchedule(schedule: Schedule) {
    const ok = window.confirm(`${schedule.title} 일정을 취소할까요?`);
    if (!ok) return;
    // 예전 일정은 candidateId가 없어서 곡과 시간으로 찾는다.
    const isSource = (candidate: PracticeCandidate) => schedule.candidateId
      ? candidate.id === schedule.candidateId
      : Boolean(schedule.songId) && candidate.songId === schedule.songId && candidate.startsAt === schedule.startsAt && candidate.endsAt === schedule.endsAt;
    const restoredCandidates = data.practiceCandidates.map((candidate) => (
      isSource(candidate) && candidate.status === "APPROVED"
        ? { ...candidate, status: "PENDING" as const, reviewedBy: undefined, reviewedAt: undefined, updatedAt: nowIso() }
        : candidate
    ));
    persist({
      ...data,
      schedules: data.schedules.filter((item) => item.id !== schedule.id),
      practiceCandidates: restoredCandidates,
    });
    if (editingScheduleId === schedule.id) setEditingScheduleId(null);
  }

  function canEditSchedule(schedule: Schedule) {
    if (schedule.visibility === "PRIVATE") return schedule.ownerUserId === currentUser.id;
    return adminMode || schedule.ownerUserId === currentUser.id;
  }

  return (
    <div className="space-y-3">
    <Tabs className="xl:hidden" tabs={[["calendar", "달력"], ["upcoming", `다가오는 일정 ${upcomingAll.length}`], ["notice", "공지"]]} value={calTab} onChange={setCalTab} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className={cn("rounded-3xl bg-card p-3 sm:p-5", calTab !== "calendar" && "hidden xl:block")}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold sm:text-xl">{monthTitle(month)}</h3>
          <div className="flex items-center gap-1.5">
            <IconButton label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></IconButton>
            <button className="rounded-xl px-3 py-2 text-sm font-medium hover:bg-muted" onClick={() => setMonth(new Date())}>오늘</button>
            <IconButton label="다음 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></IconButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1 sm:gap-2">
          {weekdays.map((day, index) => <div key={day} className={cn("pb-1 text-center text-xs font-semibold", index === 0 ? "text-red-400" : index === 6 ? "text-sky-500" : "text-muted-foreground")}>{day}</div>)}
          {monthDays.map((date) => {
            const dateKey = toDateKey(date);
            const events = visibleSchedules.filter((schedule) => sameDay(date, schedule.startsAt));
            const isCurrentMonth = date.getMonth() === month.getMonth();
            const isToday = sameDay(date, new Date().toISOString());
            const isSelected = selectedDate === dateKey;
            return (
              <button
                key={date.toISOString()}
                className={cn(
                  // 휴대폰: 테두리 없는 칸에 날짜와 색 점만. 넓은 화면: 기존 카드 + 일정 이름.
                  "flex min-h-14 flex-col items-center rounded-xl py-1.5 transition sm:min-h-24 sm:items-stretch sm:rounded-2xl sm:bg-background sm:p-2 sm:text-left",
                  !isCurrentMonth && "opacity-40",
                  isSelected ? "ring-2 ring-inset ring-foreground" : "",
                )}
                onClick={() => {
                  setSelectedDate(dateKey);
                  setShowCreate(false);
                }}
              >
                <div className="flex items-center justify-between sm:mb-2">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-sm font-semibold", isToday && "bg-primary text-primary-foreground")}>{date.getDate()}</span>
                  {events.length > 2 && <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium sm:inline">+{events.length - 2}</span>}
                </div>
                <div className="mt-1 flex items-center gap-0.5 sm:hidden">
                  {events.slice(0, 3).map((event) => <span key={event.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: eventColor(event, data, currentUser) }} />)}
                  {events.length > 3 && <span className="text-[9px] font-semibold leading-none text-muted-foreground">+{events.length - 3}</span>}
                </div>
                <div className="hidden space-y-1.5 sm:block">
                  {events.slice(0, 2).map((event) => <CalendarEventPill key={event.id} schedule={event} data={data} currentUser={currentUser} />)}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="space-y-5">
        <Panel title={`${Number(selectedDate.slice(5, 7))}월 ${Number(selectedDate.slice(8))}일 일정`} className={calTab !== "calendar" ? "hidden xl:block" : ""}>
          <div className="mb-4 space-y-2">
            {selectedEvents.length === 0 && <p className="text-sm text-muted-foreground">이 날짜에 등록된 일정이 없습니다.</p>}
            {selectedEvents.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                data={data}
                currentUser={currentUser}
                editable={canEditSchedule(schedule)}
                onEdit={() => startEditSchedule(schedule)}
                onCancel={() => cancelSchedule(schedule)}
              />
            ))}
          </div>
          {editingScheduleId && (
            <div className="mb-4 space-y-3 pt-2">
              <Field label="일정 제목" value={scheduleForm.title} onChange={(value) => setScheduleForm({ ...scheduleForm, title: value })} />
              <DateTimeField label="시작" value={scheduleForm.startsAt} onChange={(value) => setScheduleForm({ ...scheduleForm, startsAt: value })} />
              <DateTimeField label="종료" value={scheduleForm.endsAt} onChange={(value) => setScheduleForm({ ...scheduleForm, endsAt: value })} />
              {scheduleForm.color && <div className="text-sm font-medium"><p className="mb-2">색</p><ColorDots value={scheduleForm.color} onChange={(color) => setScheduleForm({ ...scheduleForm, color })} /></div>}
              {scheduleForm.startsAt >= scheduleForm.endsAt && <p className="text-sm text-destructive">종료가 시작보다 늦어야 합니다.</p>}
              <PrimaryButton onClick={saveScheduleEdit} disabled={!scheduleForm.title.trim() || scheduleForm.startsAt >= scheduleForm.endsAt}>수정 저장</PrimaryButton>
              <button className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium" onClick={() => setEditingScheduleId(null)}>닫기</button>
            </div>
          )}
          {!showCreate ? (
            <PrimaryButton onClick={() => setShowCreate(true)} icon={<Plus size={17} />}>일정 생성</PrimaryButton>
          ) : (
            <div className="space-y-3 pt-2">
              <Field label="개인 일정 제목" value={personalTitle} onChange={setPersonalTitle} />
              <div className="grid grid-cols-2 gap-2">
                <Select label="시작" value={personalStart} onChange={(value) => { setPersonalStart(value); if (personalEnd <= value) setPersonalEnd(minutesToTime(Math.min(24 * 60 - 10, timeToMinutes(value) + 60))); }} options={timeOptions(personalStart).map((item) => [item, item])} />
                <Select label="종료" value={personalEnd} onChange={setPersonalEnd} options={timeOptions(personalEnd).filter((item) => item > personalStart).map((item) => [item, item])} />
              </div>
              <div className="text-sm font-medium"><p className="mb-2">색</p><ColorDots value={personalColorPick} onChange={setPersonalColorPick} /></div>
              <PrimaryButton onClick={addPersonalSchedule} disabled={!personalTitle.trim() || personalEnd <= personalStart}>개인 일정 추가</PrimaryButton>
              <button className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium" onClick={() => setShowCreate(false)}>닫기</button>
            </div>
          )}
        </Panel>
        <Panel title="다가오는 일정" className={calTab !== "upcoming" ? "hidden xl:block" : ""}>
          <div className="space-y-3">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground">다가오는 일정이 없습니다.</p>}
            {upcoming.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} data={data} currentUser={currentUser} />)}
          </div>
          {upcomingAll.length > 5 && (
            <button type="button" className="mt-3 w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium text-muted-foreground" onClick={() => setShowAllUpcoming((value) => !value)}>
              {showAllUpcoming ? "접기" : `더보기 ${upcomingAll.length - 5}개`}
            </button>
          )}
        </Panel>
        <Panel title="고정 공지" className={calTab !== "notice" ? "hidden xl:block" : ""}><div className="space-y-3">{pinned.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</div></Panel>
      </aside>
    </div>
    </div>
  );
}
