import { Check, Clock3, Download, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { currentTerm, formatDateTime, toDatetimeLocal, formatSongDuration, formatTotalDuration, nowIso, parseSongDuration, termLabel, today } from "@/lib/format";
import { fixSongLeaders } from "@/lib/local-data";
import { alpha, isPastPerformance, palette, teamColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, Notice, Performance, Schedule, Song, SongMember } from "@/types/domain";
import { UserPill } from "@/components/items";
import { DateTimeField, Field, Panel, PrimaryButton, Select, SoftCheckbox, SwipeActions, Tabs, TextArea } from "@/components/ui";

export function PerformanceManager({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.performances.find((item) => item.id === selectedId) ?? null;
  const detailRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"list" | "create">("list");
  useEffect(() => {
    if (selectedId) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);
  const [perf, setPerf] = useState({ title: "", startsAt: `${today()}T19:00`, endsAt: `${today()}T21:00`, location: "" });

  function addPerformance() {
    if (!perf.title.trim() || perf.startsAt >= perf.endsAt) return;
    const createdAt = nowIso();
    const performance: Performance = {
      id: uid("perf"),
      title: perf.title,
      color: palette[data.performances.length % palette.length],
      startsAt: new Date(perf.startsAt).toISOString(),
      endsAt: new Date(perf.endsAt).toISOString(),
      location: perf.location,
      memberIds: [],
      status: "ACTIVE",
      createdBy: currentUser.id,
      createdAt,
      updatedAt: createdAt,
    };
    const schedule: Schedule = {
      id: uid("schedule"),
      type: "PERFORMANCE",
      title: performance.title,
      startsAt: performance.startsAt,
      endsAt: performance.endsAt,
      color: performance.color,
      performanceId: performance.id,
      visibility: "PUBLIC",
      status: "CONFIRMED",
      createdBy: currentUser.id,
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, performances: [...data.performances, performance], schedules: [...data.schedules, schedule] });
    setPerf({ title: "", startsAt: `${today()}T19:00`, endsAt: `${today()}T21:00`, location: "" });
    setTab("list");
  }

  const upcoming = data.performances.filter((performance) => !isPastPerformance(performance)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = data.performances.filter((performance) => isPastPerformance(performance)).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const performanceCard = (performance: Performance) => (
    <button key={performance.id} style={{ backgroundColor: performance.color }} className={cn("rounded-2xl p-4 text-left text-neutral-900 transition", selected?.id === performance.id && "ring-2 ring-foreground ring-offset-2 ring-offset-card")} onClick={() => setSelectedId(selected?.id === performance.id ? null : performance.id)}>
      <p className="font-semibold">{performance.title}</p>
      <p className="mt-1 text-sm text-neutral-700">{formatDateTime(performance.startsAt)} · {performance.location || "장소 미정"}</p>
    </button>
  );

  return (
    <section className="space-y-4">
      <Tabs tabs={[["list", "공연 목록"], ["create", "공연 만들기"]]} value={tab} onChange={setTab} />
      {tab === "create" && (
        <Panel title="공연 만들기">
          <div className="space-y-3">
            <Field label="공연명" value={perf.title} onChange={(value) => setPerf({ ...perf, title: value })} />
            <DateTimeField label="시작" value={perf.startsAt} onChange={(value) => setPerf({ ...perf, startsAt: value })} />
            <DateTimeField label="종료" value={perf.endsAt} onChange={(value) => setPerf({ ...perf, endsAt: value })} />
            {perf.startsAt >= perf.endsAt && <p className="text-sm text-destructive">종료가 시작보다 늦어야 합니다.</p>}
            <Field label="장소" value={perf.location} onChange={(value) => setPerf({ ...perf, location: value })} />
            <PrimaryButton onClick={addPerformance} disabled={!perf.title.trim() || perf.startsAt >= perf.endsAt}>생성</PrimaryButton>
          </div>
        </Panel>
      )}
      {tab === "list" && (
        <Panel title="공연 목록">
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">예정된 공연이 없습니다.</p>}
          <div className="grid gap-3 md:grid-cols-2">{upcoming.map(performanceCard)}</div>
          {past.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">지난 공연 {past.length}개</summary>
              <div className="mt-3 grid gap-3 opacity-70 md:grid-cols-2">{past.map(performanceCard)}</div>
            </details>
          )}
        </Panel>
      )}
      <div ref={detailRef} className="scroll-mt-20">
        {selected && <PerformanceDetail key={selected.id} data={data} currentUser={currentUser} performance={selected} persist={persist} />}
      </div>
    </section>
  );
}

function PerformanceDetail({ data, currentUser, performance, persist }: { data: AppData; currentUser: ClubUser; performance: Performance; persist: (data: AppData) => void }) {
  const performanceMemberIds = performance.memberIds ?? [];
  const performanceMembers = data.users.filter((user) => performanceMemberIds.includes(user.id));
  const songs = data.songs.filter((song) => song.performanceId === performance.id);
  const [description, setDescription] = useState(performance.description ?? "");
  const [noticeText, setNoticeText] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songDuration, setSongDuration] = useState("");
  const [songTeamId, setSongTeamId] = useState(data.teams[0]?.id ?? "");
  const [songMemberIds, setSongMemberIds] = useState<string[]>([]);
  const [leaderIds, setLeaderIds] = useState<string[]>([]);
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [orderingSongId, setOrderingSongId] = useState<string | null>(null);
  const [selectedRuntimeSongIds, setSelectedRuntimeSongIds] = useState<string[]>([]);
  const [transitionInput, setTransitionInput] = useState(String(performance.transitionSeconds ?? 5));
  const [breakAfterSongId, setBreakAfterSongId] = useState("");
  const [breakDuration, setBreakDuration] = useState("10:00");
  const [editSongForm, setEditSongForm] = useState({ title: "", duration: "", teamId: "", memberIds: [] as string[], leaderUserId: "" });
  const [editingMembers, setEditingMembers] = useState(false);
  const [draftMemberIds, setDraftMemberIds] = useState<string[]>(performanceMemberIds);
  const [performanceMemberSearch, setPerformanceMemberSearch] = useState("");
  const knownTerms = Array.from(new Set(data.users.flatMap((user) => user.activeTerms ?? []))).sort();
  const defaultTerm = knownTerms.includes(currentTerm()) ? currentTerm() : knownTerms[knownTerms.length - 1] ?? currentTerm();
  const [memberTerm, setMemberTerm] = useState(defaultTerm);
  const [songMemberTeamFilter, setSongMemberTeamFilter] = useState("all");
  const [songMemberSearch, setSongMemberSearch] = useState("");
  const initializedPerformanceId = useRef("");
  const filteredPerformanceUsers = useMemo(() => {
    const keyword = performanceMemberSearch.trim().toLowerCase();
    return data.users.filter((user) => {
      // 이미 고른 사람은 학기와 상관없이 보여준다.
      const inTerm = memberTerm === "all" || (user.activeTerms ?? []).includes(memberTerm) || draftMemberIds.includes(user.id);
      const team = data.teams.find((item) => item.id === user.teamId);
      return inTerm && (!keyword || user.name.toLowerCase().includes(keyword) || (team?.name ?? "").toLowerCase().includes(keyword));
    });
  }, [data.teams, data.users, performanceMemberSearch, memberTerm, draftMemberIds]);
  const filteredSongMembers = useMemo(() => {
    const keyword = songMemberSearch.trim().toLowerCase();
    return performanceMembers.filter((user) => {
      const team = data.teams.find((item) => item.id === user.teamId);
      const matchesTeam = songMemberTeamFilter === "all" || user.teamId === songMemberTeamFilter;
      const matchesSearch = !keyword || user.name.toLowerCase().includes(keyword) || user.username.toLowerCase().includes(keyword) || (team?.name ?? "").toLowerCase().includes(keyword);
      return matchesTeam && matchesSearch;
    });
  }, [data.teams, performanceMembers, songMemberSearch, songMemberTeamFilter]);
  const orderedSongs = songs.slice().sort((a, b) => a.order - b.order);
  const selectedRuntimeSongs = orderedSongs.filter((song) => selectedRuntimeSongIds.includes(song.id));
  const songRuntimeSeconds = selectedRuntimeSongs.reduce((total, song) => total + (song.durationSeconds ?? 0), 0);
  const missingRuntimeCount = selectedRuntimeSongs.filter((song) => !song.durationSeconds).length;
  const runtimeBreaks = performance.runtimeBreaks ?? [];
  const runtimeParts = selectedRuntimeSongs.slice(0, -1).reduce((result, song) => {
    const runtimeBreak = runtimeBreaks.find((item) => item.afterSongId === song.id);
    if (runtimeBreak) return { ...result, breakSeconds: result.breakSeconds + runtimeBreak.durationSeconds };
    return { ...result, transitionCount: result.transitionCount + 1 };
  }, { transitionCount: 0, breakSeconds: 0 });
  const transitionSeconds = Math.max(0, performance.transitionSeconds ?? 5);
  const transitionRuntimeSeconds = runtimeParts.transitionCount * transitionSeconds;
  const selectedRuntimeSeconds = songRuntimeSeconds + transitionRuntimeSeconds + runtimeParts.breakSeconds;

  useEffect(() => {
    if (initializedPerformanceId.current === performance.id) return;
    initializedPerformanceId.current = performance.id;
    setDescription(performance.description ?? "");
    setDraftMemberIds(performance.memberIds ?? []);
    setEditingMembers(false);
    setPerformanceMemberSearch("");
    setSelectedRuntimeSongIds([]);
    setTransitionInput(String(performance.transitionSeconds ?? 5));
    setBreakAfterSongId(data.songs.filter((song) => song.performanceId === performance.id).sort((a, b) => a.order - b.order)[0]?.id ?? "");
    setBreakDuration("10:00");
  }, [data.songs, performance.description, performance.id, performance.memberIds, performance.transitionSeconds]);

  useEffect(() => {
    setSelectedRuntimeSongIds((ids) => {
      const next = ids.filter((id) => data.songs.some((song) => song.performanceId === performance.id && song.id === id));
      return next.length === ids.length ? ids : next;
    });
  }, [data.songs, performance.id]);

  const infoDraft = () => ({ title: performance.title, startsAt: toDatetimeLocal(performance.startsAt), endsAt: toDatetimeLocal(performance.endsAt), location: performance.location ?? "" });
  const [editingInfo, setEditingInfo] = useState(false);
  const [detailTab, setDetailTab] = useState<"songs" | "create" | "members" | "notice">("songs");
  const [focusMemberId, setFocusMemberId] = useState("");
  const focusMember = performanceMembers.find((user) => user.id === focusMemberId);
  const focusSongs = songs.filter((song) => data.songMembers.some((member) => member.songId === song.id && member.userId === focusMemberId));
  const [infoForm, setInfoForm] = useState(infoDraft);

  // 공연명/시간/장소를 바꾸면 캘린더의 공연 일정도 같이 바꾼다.
  function saveInfo() {
    const updatedAt = nowIso();
    const startsAt = new Date(infoForm.startsAt).toISOString();
    const endsAt = new Date(infoForm.endsAt).toISOString();
    const title = infoForm.title.trim();
    persist({
      ...data,
      performances: data.performances.map((item) => item.id === performance.id ? { ...item, title, startsAt, endsAt, location: infoForm.location.trim(), updatedAt } : item),
      schedules: data.schedules.map((schedule) => schedule.type === "PERFORMANCE" && schedule.performanceId === performance.id ? { ...schedule, title, startsAt, endsAt, location: infoForm.location.trim() || undefined, updatedAt } : schedule),
    });
    setEditingInfo(false);
  }

  // 공연과 그 곡, 연습 요청, 일정을 지운다. 이 공연 곡의 과거 공연 이력 카드는 기록으로 남긴다.
  function deletePerformance() {
    if (!window.confirm(`"${performance.title}" 공연을 삭제할까요? 곡 팀, 연습 요청, 공연과 연습 일정이 함께 지워집니다. 과거 공연 이력 카드는 남습니다.`)) return;
    const songIds = new Set(songs.map((song) => song.id));
    const currentKeyPrefix = `current-${performance.id}-`;
    // 이 공연만 대상으로 하던 조사는 대상이 없어지므로 응답과 함께 지운다.
    const orphanSurveyIds = new Set(data.surveys.filter((survey) => survey.performanceIds.length === 1 && survey.performanceIds[0] === performance.id).map((survey) => survey.id));
    persist({
      ...data,
      performances: data.performances.filter((item) => item.id !== performance.id),
      songs: data.songs.filter((song) => !songIds.has(song.id)),
      songMembers: data.songMembers.filter((member) => !songIds.has(member.songId)),
      schedules: data.schedules.filter((schedule) => schedule.performanceId !== performance.id && !(schedule.songId && songIds.has(schedule.songId))),
      practiceCandidates: data.practiceCandidates.filter((candidate) => !songIds.has(candidate.songId) && !orphanSurveyIds.has(candidate.surveyId)),
      surveys: data.surveys.filter((survey) => !orphanSurveyIds.has(survey.id)).map((survey) => survey.performanceIds.includes(performance.id) ? { ...survey, performanceIds: survey.performanceIds.filter((id) => id !== performance.id) } : survey),
      availabilityResponses: data.availabilityResponses.filter((response) => !orphanSurveyIds.has(response.surveyId)),
      notices: data.notices.filter((notice) => notice.targetPerformanceId !== performance.id),
      // 현재 곡 카드(current-)는 곡이 없어지면 사라지므로 일반 이력 카드로 바꿔 남긴다.
      archiveSongs: data.archiveSongs.map((item) => item.archiveKey.startsWith(currentKeyPrefix) ? { ...item, archiveKey: `kept-${item.id}`, source: "지난 공연" } : item),
    });
  }

  function updatePerformance(partial: Partial<Performance>) {
    persist({ ...data, performances: data.performances.map((item) => (item.id === performance.id ? { ...item, ...partial, updatedAt: nowIso() } : item)) });
  }

  function saveTransitionSeconds() {
    const seconds = Math.max(0, Math.floor(Number(transitionInput) || 0));
    setTransitionInput(String(seconds));
    updatePerformance({ transitionSeconds: seconds });
  }

  function saveRuntimeBreak() {
    const durationSeconds = parseSongDuration(breakDuration);
    if (!breakAfterSongId || !durationSeconds) return;
    const nextBreaks = [
      ...runtimeBreaks.filter((item) => item.afterSongId !== breakAfterSongId),
      { afterSongId: breakAfterSongId, durationSeconds },
    ];
    updatePerformance({ runtimeBreaks: nextBreaks });
  }

  function removeRuntimeBreak(afterSongId: string) {
    updatePerformance({ runtimeBreaks: runtimeBreaks.filter((item) => item.afterSongId !== afterSongId) });
  }

  function changeSongOrder(songId: string, position: number) {
    const movingSong = orderedSongs.find((song) => song.id === songId);
    if (!movingSong) return;
    const reordered = orderedSongs.filter((song) => song.id !== songId);
    reordered.splice(Math.max(0, Math.min(position - 1, reordered.length)), 0, movingSong);
    const orderById = new Map(reordered.map((song, index) => [song.id, index + 1]));
    const updatedAt = nowIso();
    persist({
      ...data,
      songs: data.songs.map((song) => {
        const order = orderById.get(song.id);
        return order === undefined || order === song.order ? song : { ...song, order, updatedAt };
      }),
    });
    setOrderingSongId(null);
  }

  async function exportSelectedSetlist() {
    if (selectedRuntimeSongs.length === 0) return;
    const XLSX = await import("xlsx-js-style");
    const selectedMemberNames = Array.from(new Set(selectedRuntimeSongs.flatMap((song) =>
      data.songMembers
        .filter((member) => member.songId === song.id)
        .map((member) => data.users.find((user) => user.id === member.userId)?.name)
        .filter((name): name is string => Boolean(name)),
    )));
    const rows = [
      ["곡 제목", "소속 팀", "인원", "런타임"],
      ...selectedRuntimeSongs.map((song) => {
        const team = data.teams.find((item) => item.id === song.teamId);
        const memberNames = data.songMembers
          .filter((member) => member.songId === song.id)
          .map((member) => data.users.find((user) => user.id === member.userId)?.name)
          .filter((name): name is string => Boolean(name));
        return [song.title, team?.name ?? "팀 없음", memberNames.join(", "), formatSongDuration(song.durationSeconds)];
      }),
      ["합계", `총 ${selectedRuntimeSongs.length}곡`, `참여 인원 ${selectedMemberNames.length}명`, formatTotalDuration(selectedRuntimeSeconds)],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [{ wch: 23 }, { wch: 11 }, { wch: 44 }, { wch: 14 }];
    worksheet["!autofilter"] = { ref: `A1:D${rows.length - 1}` };
    const border = {
      top: { style: "thin", color: { rgb: "D7E7F2" } },
      bottom: { style: "thin", color: { rgb: "D7E7F2" } },
      left: { style: "thin", color: { rgb: "D7E7F2" } },
      right: { style: "thin", color: { rgb: "D7E7F2" } },
    };

    for (let column = 0; column < 4; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: column })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: "263342" } }, fill: { fgColor: { rgb: "E8EEF2" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    }
    selectedRuntimeSongs.forEach((song, rowIndex) => {
      const team = data.teams.find((item) => item.id === song.teamId);
      const rowColor = team?.name === "춤" ? "FFFFFF" : team?.name === "랩" ? "FFF3BF" : team?.name === "기획" ? "E2F5EF" : "F4F7F9";
      for (let column = 0; column < 4; column += 1) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: column })];
        if (cell) cell.s = { fill: { fgColor: { rgb: rowColor } }, alignment: { vertical: "center", wrapText: column === 2 }, border };
      }
    });
    const totalRowIndex = rows.length - 1;
    for (let column = 0; column < 4; column += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: totalRowIndex, c: column })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: "263342" } }, fill: { fgColor: { rgb: "DDE7EC" } }, alignment: { horizontal: column === 0 ? "center" : "left", vertical: "center" }, border };
    }
    worksheet["!rows"] = [{ hpt: 22 }, ...selectedRuntimeSongs.map(() => ({ hpt: 25 })), { hpt: 26 }];
    const workbook = XLSX.utils.book_new();
    const sheetName = `${performance.title}_setlist`.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31) || "setlist";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const fileName = `${performance.title}_setlist.xlsx`.replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(workbook, fileName);
  }

  function togglePerformanceMember(userId: string) {
    setDraftMemberIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  }

  function savePerformanceMembers() {
    const songIds = new Set(songs.map((song) => song.id));
    persist(fixSongLeaders({
      ...data,
      performances: data.performances.map((item) => item.id === performance.id ? { ...item, memberIds: draftMemberIds, updatedAt: nowIso() } : item),
      songMembers: data.songMembers.filter((member) => !songIds.has(member.songId) || draftMemberIds.includes(member.userId)),
    }));
    setEditingMembers(false);
  }

  function addPerformanceNotice() {
    if (!noticeText.trim()) return;
    const createdAt = nowIso();
    const notice: Notice = { id: uid("notice"), type: "PERFORMANCE", title: `${performance.title} 공지`, content: noticeText, targetPerformanceId: performance.id, pinned: false, createdBy: currentUser.id, createdAt, updatedAt: createdAt };
    persist({ ...data, notices: [...data.notices, notice] });
    setNoticeText("");
  }

  function addSong() {
    const leaderUserId = leaderIds[0];
    if (!songTitle.trim() || songMemberIds.length === 0 || !leaderUserId) return;
    const createdAt = nowIso();
    const song: Song = { id: uid("song"), performanceId: performance.id, teamId: songTeamId, title: songTitle, durationSeconds: parseSongDuration(songDuration), leaderUserId, requiredPracticeCount: 0, estimatedPracticeMinutes: 120, order: data.songs.length + 1, status: "ACTIVE", createdAt, updatedAt: createdAt };
    const memberships: SongMember[] = songMemberIds.map((userId) => ({ id: uid("member"), performanceId: performance.id, songId: song.id, userId, joinedAt: createdAt }));
    persist({ ...data, songs: [...data.songs, song], songMembers: [...data.songMembers, ...memberships] });
    setSongTitle("");
    setSongDuration("");
    setSongMemberIds([]);
    setLeaderIds([]);
    setDetailTab("songs");
  }

  function startEditSong(song: Song) {
    const memberIds = data.songMembers.filter((member) => member.songId === song.id).map((member) => member.userId);
    setEditingSongId(song.id);
    setEditSongForm({ title: song.title, duration: formatSongDuration(song.durationSeconds), teamId: song.teamId, memberIds, leaderUserId: song.leaderUserId });
  }

  function saveSongEdit(songId: string) {
    if (!editSongForm.title.trim() || editSongForm.memberIds.length === 0) return;
    const updatedAt = nowIso();
    const leaderUserId = editSongForm.memberIds.includes(editSongForm.leaderUserId) ? editSongForm.leaderUserId : editSongForm.memberIds[0];
    const nextMemberships: SongMember[] = editSongForm.memberIds.map((userId) => ({ id: uid("member"), performanceId: performance.id, songId, userId, joinedAt: updatedAt }));
    persist({
      ...data,
      songs: data.songs.map((song) => song.id === songId ? { ...song, title: editSongForm.title, durationSeconds: parseSongDuration(editSongForm.duration), teamId: editSongForm.teamId, leaderUserId, updatedAt } : song),
      songMembers: [...data.songMembers.filter((member) => member.songId !== songId), ...nextMemberships],
    });
    setEditingSongId(null);
  }

  function deleteSong(songId: string) {
    const target = data.songs.find((song) => song.id === songId);
    if (!target) return;
    const ok = window.confirm(`${target.title} 곡을 삭제할까요? 관련 연습 요청과 일정도 함께 삭제됩니다.`);
    if (!ok) return;
    persist({
      ...data,
      performances: data.performances.map((item) => item.id === performance.id ? { ...item, runtimeBreaks: (item.runtimeBreaks ?? []).filter((runtimeBreak) => runtimeBreak.afterSongId !== songId), updatedAt: nowIso() } : item),
      songs: data.songs.filter((song) => song.id !== songId),
      songMembers: data.songMembers.filter((member) => member.songId !== songId),
      practiceCandidates: data.practiceCandidates.filter((candidate) => candidate.songId !== songId),
      schedules: data.schedules.filter((schedule) => schedule.songId !== songId),
    });
    if (editingSongId === songId) setEditingSongId(null);
  }

  return (
    <Panel title={`${performance.title} 상세${isPastPerformance(performance) ? " (지난 공연)" : ""}`} className="p-2.5 sm:p-6">
      <div className="mb-5 space-y-3 rounded-2xl bg-background p-4">
        {editingInfo ? (
          <>
            <Field label="공연명" value={infoForm.title} onChange={(value) => setInfoForm({ ...infoForm, title: value })} />
            <div className="grid gap-2 sm:grid-cols-2">
              <DateTimeField label="시작" value={infoForm.startsAt} onChange={(value) => setInfoForm({ ...infoForm, startsAt: value })} />
              <DateTimeField label="종료" value={infoForm.endsAt} onChange={(value) => setInfoForm({ ...infoForm, endsAt: value })} />
            </div>
            <Field label="장소" value={infoForm.location} onChange={(value) => setInfoForm({ ...infoForm, location: value })} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-full bg-muted px-4 py-3 text-sm font-semibold" onClick={() => setEditingInfo(false)}>취소</button>
              <PrimaryButton onClick={saveInfo} disabled={!infoForm.title.trim() || !infoForm.startsAt || !infoForm.endsAt || infoForm.startsAt >= infoForm.endsAt}>저장</PrimaryButton>
            </div>
          </>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{formatDateTime(performance.startsAt)} ~ {formatDateTime(performance.endsAt)}</p>
              <p className="text-muted-foreground">{performance.location || "장소 미정"}</p>
              {performance.description && <p className="mt-2 whitespace-pre-wrap leading-6 text-muted-foreground">{performance.description}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <button type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold" onClick={() => { setInfoForm(infoDraft()); setEditingInfo(true); }}>정보 수정</button>
              <button type="button" className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-destructive" onClick={deletePerformance}>공연 삭제</button>
            </div>
          </div>
        )}
      </div>
      <Tabs className="mb-3" tabs={[["songs", `곡 팀 ${songs.length}`], ["create", "팀 만들기"], ["members", `참여 인원 ${performanceMembers.length}`], ["notice", "공지"]]} value={detailTab} onChange={setDetailTab} />
      {detailTab === "members" && (
        <Panel title="공연 참여 인원" className="bg-background p-3 sm:p-6">
          {!editingMembers ? (
            <div className="space-y-4">
              <div className="flex min-h-24 flex-wrap content-start gap-2">
                {performanceMembers.length === 0 && <p className="text-sm text-muted-foreground">아직 지정된 참여 인원이 없습니다.</p>}
                {performanceMembers.map((user) => (
                  <button key={user.id} type="button" className={cn("rounded-full", focusMemberId === user.id && "ring-2 ring-foreground")} onClick={() => setFocusMemberId(focusMemberId === user.id ? "" : user.id)}>
                    <UserPill user={user} data={data} />
                  </button>
                ))}
              </div>
              {focusMember && (
                <div className="rounded-2xl bg-card p-3 text-sm">
                  <p className="mb-2 font-semibold">{focusMember.name} 참여 곡</p>
                  {focusSongs.length === 0 ? (
                    <p className="text-muted-foreground">이 공연에서 참여하는 곡이 없습니다.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {focusSongs.map((song) => (
                        <span key={song.id} className="rounded-full px-3 py-1.5 text-sm font-medium text-neutral-900" style={{ backgroundColor: teamColor(data.teams.find((team) => team.id === song.teamId)) }}>
                          {song.title}{song.leaderUserId === focusMember.id && " (곡팀장)"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <PrimaryButton onClick={() => { setDraftMemberIds(performanceMemberIds); setEditingMembers(true); }}>지정하기</PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                className="w-full rounded-xl bg-background px-4 py-3 text-sm font-medium outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/30"
                value={performanceMemberSearch}
                onChange={(event) => setPerformanceMemberSearch(event.target.value)}
                placeholder="이름이나 팀으로 검색"
              />
              <div className="flex flex-wrap gap-2">
                {[...knownTerms, "all"].map((term) => (
                  <button key={term} type="button" className={cn("rounded-full px-3 py-1.5 text-xs font-semibold", memberTerm === term ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")} onClick={() => setMemberTerm(term)}>
                    {term === "all" ? "전체" : termLabel(term)}
                  </button>
                ))}
              </div>
              <div className="grid max-h-80 gap-2 overflow-auto">
                {filteredPerformanceUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold" style={{ backgroundColor: alpha(teamColor(data.teams.find((team) => team.id === user.teamId)), "2E") }}>
                    <UserPill user={user} data={data} />
                    <SoftCheckbox checked={draftMemberIds.includes(user.id)} label="선택" onToggle={() => togglePerformanceMember(user.id)} />
                  </div>
                ))}
                {filteredPerformanceUsers.length === 0 && <p className="rounded-xl bg-background p-4 text-sm font-medium text-muted-foreground">검색 결과가 없습니다.</p>}
              </div>
              <PrimaryButton onClick={savePerformanceMembers}>저장하기</PrimaryButton>
              <button className="w-full rounded-xl bg-muted px-4 py-3 text-sm font-medium" onClick={() => setEditingMembers(false)}>닫기</button>
            </div>
          )}
        </Panel>
      )}
      {detailTab === "create" && (
        <Panel title="곡 팀 만들기" className="bg-background p-3 sm:p-6">
          <div className="space-y-3">
            <Select label="소속 팀" value={songTeamId} onChange={setSongTeamId} options={data.teams.map((team) => [team.id, team.name])} />
            <Field label="곡 / 무대 이름" value={songTitle} onChange={setSongTitle} />
            <Field label="곡 시간 (선택, 분:초)" value={songDuration} onChange={setSongDuration} placeholder="예: 3:30" />
            <div className="rounded-xl bg-muted p-3">
              <p className="mb-3 text-sm font-semibold">팀원 / 곡팀장</p>
              <input
                className="mb-3 w-full rounded-xl bg-background px-4 py-3 text-sm font-medium outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/30"
                value={songMemberSearch}
                onChange={(event) => setSongMemberSearch(event.target.value)}
                placeholder="이름이나 아이디로 검색"
              />
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={cn("rounded-full px-3 py-2 text-xs font-semibold transition", songMemberTeamFilter === "all" ? "bg-primary text-primary-foreground shadow-sm" : "bg-background text-muted-foreground")}
                  onClick={() => setSongMemberTeamFilter("all")}
                >
                  전체
                </button>
                {data.teams.map((team) => (
                  <button
                    type="button"
                    key={team.id}
                    className={cn("rounded-full px-3 py-2 text-xs font-semibold transition", songMemberTeamFilter === team.id ? "text-white shadow-sm" : "text-foreground")}
                    style={{ backgroundColor: songMemberTeamFilter === team.id ? teamColor(team) : alpha(teamColor(team), "35") }}
                    onClick={() => setSongMemberTeamFilter(team.id)}
                  >
                    {team.name}팀만 보기
                  </button>
                ))}
              </div>
              <div className="grid max-h-44 gap-2 overflow-auto">
                {filteredSongMembers.map((user) => (
                  <div key={user.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-xl bg-background p-2 text-sm">
                    <UserPill user={user} data={data} />
                    <SoftCheckbox checked={songMemberIds.includes(user.id)} label="참여" onToggle={() => setSongMemberIds((prev) => prev.includes(user.id) ? prev.filter((id) => id !== user.id) : [...prev, user.id])} />
                    <SoftCheckbox
                      checked={leaderIds.includes(user.id)}
                      label="곡팀장"
                      onToggle={() => {
                        // 곡팀장은 한 명. 고르면 팀원에도 자동으로 들어간다.
                        setLeaderIds((prev) => prev.includes(user.id) ? [] : [user.id]);
                        setSongMemberIds((prev) => prev.includes(user.id) ? prev : [...prev, user.id]);
                      }}
                    />
                  </div>
                ))}
                {filteredSongMembers.length === 0 && <p className="rounded-xl bg-background p-4 text-sm font-medium text-muted-foreground">{performanceMembers.length === 0 ? "먼저 공연 참여 인원을 등록하세요." : "조건에 맞는 인원이 없습니다."}</p>}
              </div>
            </div>
            <PrimaryButton onClick={addSong} disabled={!songTitle.trim() || songMemberIds.length === 0 || leaderIds.length === 0}>곡 팀 만들기</PrimaryButton>
          </div>
        </Panel>
      )}
      {detailTab === "notice" && (
        <Panel title="공연 상세 공지" className="bg-background p-3 sm:p-6">
          <div className="space-y-3">
            <TextArea label="공연 설명 / 운영 메모" value={description} onChange={setDescription} />
            <PrimaryButton onClick={() => updatePerformance({ description })}>설명 저장</PrimaryButton>
            <TextArea label="참여 인원에게 보이는 공지" value={noticeText} onChange={setNoticeText} />
            <PrimaryButton onClick={addPerformanceNotice}>공지 추가</PrimaryButton>
          </div>
        </Panel>
      )}
      {detailTab === "songs" && (
      <Panel title="생성된 공연 곡" className="bg-background p-3 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-primary/10 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Clock3 size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-primary">선택 곡 러닝타임</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                {selectedRuntimeSongs.length > 0 ? `${selectedRuntimeSongs.length}/${songs.length}곡 선택` : "곡 카드를 눌러 선택"}
                {missingRuntimeCount > 0 ? ` · 시간 미입력 ${missingRuntimeCount}곡 제외` : ""}
              </p>
              {selectedRuntimeSongs.length > 0 && (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  곡 {formatTotalDuration(songRuntimeSeconds)} · 입퇴장 {formatTotalDuration(transitionRuntimeSeconds)} · 쉬는시간 {formatTotalDuration(runtimeParts.breakSeconds)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <div className="flex shrink-0 rounded-xl bg-background p-1">
              <button type="button" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-background" onClick={() => setSelectedRuntimeSongIds(orderedSongs.map((song) => song.id))}>전체</button>
              <button type="button" className="whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-background" onClick={() => setSelectedRuntimeSongIds([])}>해제</button>
            </div>
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-35"
              disabled={selectedRuntimeSongs.length === 0}
              onClick={exportSelectedSetlist}
              aria-label="선택 곡 셋리스트 엑셀 내보내기"
              title="선택 곡 셋리스트 엑셀 내보내기"
            >
              <Download size={18} />
            </button>
            <p className="ml-auto whitespace-nowrap text-lg font-semibold tabular-nums sm:text-xl">{formatTotalDuration(selectedRuntimeSeconds)}</p>
          </div>
        </div>
        <div className="mb-4 grid gap-2 rounded-2xl bg-muted p-2 sm:gap-3 sm:p-4 lg:grid-cols-[minmax(220px,0.75fr)_minmax(0,1.5fr)]">
          <div className="rounded-xl bg-background p-3 sm:p-4">
            <p className="mb-3 text-sm font-semibold">곡 사이 입퇴장</p>
            <div className="flex items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">
                시간(초)
                <input
                  className="mt-1 w-full rounded-xl bg-background px-3 py-2.5 text-base font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={transitionInput}
                  onChange={(event) => setTransitionInput(event.target.value)}
                />
              </label>
              <button type="button" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground" onClick={saveTransitionSeconds}>저장</button>
            </div>
          </div>
          <div className="rounded-xl bg-background p-3 sm:p-4">
            <p className="mb-3 text-sm font-semibold">쉬는시간</p>
            {orderedSongs.length > 1 ? (
              <>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
                  <Select label="이 곡 뒤" value={breakAfterSongId || orderedSongs[0]?.id || ""} onChange={setBreakAfterSongId} options={orderedSongs.slice(0, -1).map((song) => [song.id, song.title])} />
                  <Field label="시간" value={breakDuration} onChange={setBreakDuration} placeholder="10:00" />
                  <button type="button" className="rounded-xl bg-primary px-4 py-4 text-sm font-semibold text-primary-foreground" onClick={saveRuntimeBreak}>추가</button>
                </div>
                {runtimeBreaks.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runtimeBreaks.map((runtimeBreak) => {
                      const song = songs.find((item) => item.id === runtimeBreak.afterSongId);
                      if (!song) return null;
                      return (
                        <button key={runtimeBreak.afterSongId} type="button" className="inline-flex items-center gap-2 rounded-full bg-primary/12 px-3 py-2 text-xs font-semibold text-primary" onClick={() => removeRuntimeBreak(runtimeBreak.afterSongId)}>
                          {song.title} 뒤 · {formatSongDuration(runtimeBreak.durationSeconds)}
                          <Trash2 size={13} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm font-medium text-muted-foreground">곡이 2개 이상일 때 설정할 수 있습니다.</p>
            )}
          </div>
        </div>
        <div className="grid gap-3">
          {orderedSongs.map((song, songIndex) => {
            const team = data.teams.find((item) => item.id === song.teamId);
            const members = data.songMembers.filter((member) => member.songId === song.id).map((member) => data.users.find((user) => user.id === member.userId)).filter(Boolean) as ClubUser[];
            const editing = editingSongId === song.id;
            const selectedForRuntime = selectedRuntimeSongIds.includes(song.id);
            if (!editing) {
              return (
                <SwipeActions key={song.id} onEdit={() => startEditSong(song)} onDelete={() => deleteSong(song.id)}>
                  <div
                    className={cn("relative cursor-pointer rounded-2xl p-4 pl-16 pr-14 text-neutral-900 transition", selectedForRuntime && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                    style={{ backgroundColor: teamColor(team) }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selectedForRuntime}
                    onClick={() => setSelectedRuntimeSongIds((ids) => ids.includes(song.id) ? ids.filter((id) => id !== song.id) : [...ids, song.id])}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      setSelectedRuntimeSongIds((ids) => ids.includes(song.id) ? ids.filter((id) => id !== song.id) : [...ids, song.id]);
                    }}
                  >
                    <button
                      type="button"
                      className={cn("absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold tabular-nums transition", orderingSongId === song.id ? "bg-primary text-primary-foreground" : "bg-background text-primary hover:bg-muted")}
                      aria-label={`${song.title} 순서 변경`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOrderingSongId((id) => id === song.id ? null : song.id);
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      {songIndex + 1}
                    </button>
                    <span className={cn("absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full transition", selectedForRuntime ? "bg-primary text-primary-foreground" : "bg-background text-transparent")}>
                      <Check size={15} strokeWidth={3} />
                    </span>
                    <p className="text-lg font-semibold">{song.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {team?.name ?? "팀 없음"} · 팀장 {data.users.find((user) => user.id === song.leaderUserId)?.name ?? "미지정"}
                      {song.durationSeconds ? ` · ${formatSongDuration(song.durationSeconds)}` : ""}
                    </p>
                    {orderingSongId === song.id && (
                      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-background p-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                        {orderedSongs.map((_, index) => {
                          const position = index + 1;
                          return (
                            <button
                              key={position}
                              type="button"
                              className={cn("grid h-9 w-9 place-items-center rounded-xl text-xs font-semibold tabular-nums transition", position === songIndex + 1 ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary hover:bg-primary/20")}
                              onClick={() => changeSongOrder(song.id, position)}
                            >
                              {position}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {members.map((user) => <UserPill key={user.id} user={user} data={data} />)}
                    </div>
                    <div className="mt-3 flex gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <button type="button" className="rounded-full bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white" onClick={() => startEditSong(song)}>팀 수정</button>
                      <button type="button" className="rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-neutral-900" onClick={() => deleteSong(song.id)}>삭제</button>
                    </div>
                  </div>
                </SwipeActions>
              );
            }
            return (
              <div key={song.id} className="rounded-2xl p-4 text-neutral-900" style={{ backgroundColor: teamColor(team) }}>
                  <div className="space-y-3">
                    <Field label="곡 / 무대 이름" value={editSongForm.title} onChange={(value) => setEditSongForm({ ...editSongForm, title: value })} />
                    <Field label="곡 시간 (선택, 분:초)" value={editSongForm.duration} onChange={(value) => setEditSongForm({ ...editSongForm, duration: value })} placeholder="예: 3:30" />
                    <Select label="소속 팀" value={editSongForm.teamId} onChange={(value) => setEditSongForm({ ...editSongForm, teamId: value })} options={data.teams.map((item) => [item.id, item.name])} />
                    <div className="rounded-xl bg-background p-3">
                      <p className="mb-2 text-sm font-semibold">팀원 / 곡팀장</p>
                      <div className="grid max-h-56 gap-2 overflow-auto">
                        {performanceMembers.map((user) => (
                          <div key={user.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-xl bg-background p-2 text-sm">
                            <UserPill user={user} data={data} />
                            <SoftCheckbox
                              checked={editSongForm.memberIds.includes(user.id)}
                              label="참여"
                              onToggle={() => setEditSongForm((prev) => {
                                const memberIds = prev.memberIds.includes(user.id) ? prev.memberIds.filter((id) => id !== user.id) : [...prev.memberIds, user.id];
                                return { ...prev, memberIds, leaderUserId: memberIds.includes(prev.leaderUserId) ? prev.leaderUserId : memberIds[0] ?? "" };
                              })}
                            />
                            <SoftCheckbox
                              checked={editSongForm.leaderUserId === user.id}
                              label="곡팀장"
                              onToggle={() => setEditSongForm((prev) => ({ ...prev, leaderUserId: user.id, memberIds: prev.memberIds.includes(user.id) ? prev.memberIds : [...prev.memberIds, user.id] }))}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <PrimaryButton onClick={() => saveSongEdit(song.id)}>수정 저장</PrimaryButton>
                      <button type="button" className="rounded-xl bg-background px-4 py-3 text-sm font-semibold" onClick={() => setEditingSongId(null)}>취소</button>
                    </div>
                  </div>
              </div>
            );
          })}
        </div>
      </Panel>
      )}
    </Panel>
  );
}
