import { useRef, useState } from "react";
import { formatSongDuration, nowIso, parseSongDuration } from "@/lib/format";
import { archiveYears, mergeArchiveItems, splitOriginalTag } from "@/lib/local-data";
import { archiveSourceLabel, teamColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ArchiveSong, SongMember } from "@/types/domain";
import { UserPill } from "@/components/items";
import { Field, Panel, PrimaryButton, Select, SoftCheckbox, SwipeActions, Tabs } from "@/components/ui";

export function ArchivePanel({ data, persist }: { data: AppData; persist: (data: AppData) => void }) {
  const [query, setQuery] = useState("");
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [mergeBaseId, setMergeBaseId] = useState("");
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [editingArchiveId, setEditingArchiveId] = useState("");
  const [archiveForm, setArchiveForm] = useState({ performanceTitle: "", songTitle: "", duration: "", teamId: "", leaderName: "", memberNames: [] as string[] });
  const archiveClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedMergeQuery = mergeQuery.trim().toLowerCase();
  const mergeBase = data.archiveSongs.find((item) => item.id === mergeBaseId) ?? null;
  const archiveMemberNames = Array.from(new Set(data.archiveSongs.flatMap((item) => item.memberNames))).sort((a, b) => a.localeCompare(b, "ko"));
  const filteredArchiveMembers = archiveMemberNames.filter((name) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery));
  const mergeCandidates = data.archiveSongs.filter((item) => {
    if (item.id === mergeBaseId) return false;
    if (!normalizedMergeQuery) return true;
    return [item.performanceTitle, item.songTitle, item.leaderName, ...item.memberNames].some((value) => value.toLowerCase().includes(normalizedMergeQuery));
  });
  const scoredArchives = data.archiveSongs
    .map((item) => {
      const selectedMatchCount = selectedNames.filter((name) => item.memberNames.includes(name)).length;
      const textMatches = !normalizedQuery || [
      item.performanceTitle,
      item.songTitle,
      item.leaderName,
      ...item.memberNames,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
      return { item, selectedMatchCount, textMatches };
    })
    .filter(({ selectedMatchCount, textMatches }) => (selectedNames.length > 0 ? selectedMatchCount > 0 : textMatches))
    .sort((a, b) => {
      if (b.selectedMatchCount !== a.selectedMatchCount) return b.selectedMatchCount - a.selectedMatchCount;
      return a.item.songTitle.localeCompare(b.item.songTitle, "ko");
    });
  // 연도 탭: 최신 연도부터
  const [yearTab, setYearTab] = useState("all");
  const archiveYearTabs = Array.from(new Set(data.archiveSongs.flatMap(archiveYears))).sort((a, b) => b - a);
  const visibleArchives = yearTab === "all" ? scoredArchives : scoredArchives.filter(({ item }) => archiveYears(item).includes(Number(yearTab)));

  function beginMerge(itemId: string) {
    setMergeBaseId(itemId);
    setMergeSelectedIds([]);
    setMergeQuery("");
  }

  function cancelMerge() {
    setMergeBaseId("");
    setMergeSelectedIds([]);
    setMergeQuery("");
  }

  function beginArchiveEdit(item: ArchiveSong) {
    setEditingArchiveId(item.id);
    setArchiveForm({
      performanceTitle: item.performanceTitle,
      songTitle: item.songTitle,
      duration: formatSongDuration(item.durationSeconds),
      teamId: item.teamId,
      leaderName: item.leaderName,
      memberNames: item.memberNames,
    });
  }

  function handleArchiveClick(item: ArchiveSong) {
    if (archiveClickTimer.current) clearTimeout(archiveClickTimer.current);
    archiveClickTimer.current = setTimeout(() => beginArchiveEdit(item), 220);
  }

  function handleArchiveDoubleClick(item: ArchiveSong) {
    if (archiveClickTimer.current) clearTimeout(archiveClickTimer.current);
    archiveClickTimer.current = null;
    setEditingArchiveId("");
    beginMerge(item.id);
  }

  function saveArchiveEdit() {
    const item = data.archiveSongs.find((archive) => archive.id === editingArchiveId);
    if (!item || !archiveForm.songTitle.trim()) return;
    const updatedAt = nowIso();
    const currentSong = data.songs.find((song) => item.archiveKey === `current-${song.performanceId}-${song.id}`);
    const selectedUsers = data.users.filter((user) => archiveForm.memberNames.includes(user.name));
    const leader = selectedUsers.find((user) => user.name === archiveForm.leaderName) ?? selectedUsers[0];

    if (currentSong) {
      const nextMemberships: SongMember[] = selectedUsers.map((user) => ({ id: uid("member"), performanceId: currentSong.performanceId, songId: currentSong.id, userId: user.id, joinedAt: updatedAt }));
      persist({
        ...data,
        performances: data.performances.map((performance) => performance.id === currentSong.performanceId ? { ...performance, title: archiveForm.performanceTitle.trim() || performance.title, updatedAt } : performance),
        schedules: data.schedules.map((schedule) => schedule.type === "PERFORMANCE" && schedule.performanceId === currentSong.performanceId ? { ...schedule, title: archiveForm.performanceTitle.trim() || schedule.title, updatedAt } : schedule),
        songs: data.songs.map((song) => song.id === currentSong.id ? {
          ...song,
          title: archiveForm.songTitle.trim(),
          durationSeconds: parseSongDuration(archiveForm.duration),
          teamId: archiveForm.teamId,
          leaderUserId: leader?.id ?? song.leaderUserId,
          updatedAt,
        } : song),
        songMembers: [...data.songMembers.filter((member) => member.songId !== currentSong.id), ...nextMemberships],
      });
    } else {
      persist({
        ...data,
        archiveSongs: data.archiveSongs.map((archive) => archive.id === item.id ? {
          ...archive,
          performanceTitle: archiveForm.performanceTitle.trim(),
          songTitle: archiveForm.songTitle.trim(),
          durationSeconds: parseSongDuration(archiveForm.duration),
          teamId: archiveForm.teamId,
          leaderName: archiveForm.leaderName,
          memberNames: archiveForm.memberNames,
          updatedAt,
        } : archive),
      });
    }
    setEditingArchiveId("");
  }

  function deleteArchive(item: ArchiveSong) {
    const currentSong = data.songs.find((song) => item.archiveKey === `current-${song.performanceId}-${song.id}`);
    const message = currentSong
      ? `${item.songTitle} 현재 곡과 연결된 이력을 삭제할까요? 원본 곡과 관련 연습 요청·일정도 함께 삭제됩니다.`
      : `${item.songTitle} 이력 카드를 삭제할까요?`;
    if (!window.confirm(message)) return;
    if (!currentSong) {
      persist({ ...data, archiveSongs: data.archiveSongs.filter((archive) => archive.id !== item.id) });
      return;
    }
    persist({
      ...data,
      performances: data.performances.map((performance) => performance.id === currentSong.performanceId ? { ...performance, runtimeBreaks: (performance.runtimeBreaks ?? []).filter((runtimeBreak) => runtimeBreak.afterSongId !== currentSong.id), updatedAt: nowIso() } : performance),
      songs: data.songs.filter((song) => song.id !== currentSong.id),
      songMembers: data.songMembers.filter((member) => member.songId !== currentSong.id),
      practiceCandidates: data.practiceCandidates.filter((candidate) => candidate.songId !== currentSong.id),
      schedules: data.schedules.filter((schedule) => schedule.songId !== currentSong.id),
      archiveSongs: data.archiveSongs.filter((archive) => archive.id !== item.id),
    });
  }

  function mergeArchiveSongs() {
    if (!mergeBase || mergeSelectedIds.length === 0) return;
    const selectedIds = new Set([mergeBase.id, ...mergeSelectedIds]);
    const selectedItems = data.archiveSongs.filter((item) => selectedIds.has(item.id));
    const primary = selectedItems[0];
    if (!primary) return;
    const mergedItem = mergeArchiveItems(selectedItems, data.songs);
    const removableIds = new Set(selectedItems.map((item) => item.id).filter((id) => id !== primary.id));
    persist({
      ...data,
      archiveSongs: data.archiveSongs.flatMap((item) => {
        if (item.id === primary.id) return [mergedItem];
        if (removableIds.has(item.id)) return [];
        return [item];
      }),
    });
    cancelMerge();
  }

  return (
    <section className="space-y-5">
      <Panel title="과거 공연 이력 DB">
        <div>
          <input
            className="w-full rounded-xl bg-muted px-5 py-4 text-sm font-medium outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/30"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="공연명, 곡명, 팀원 이름 검색"
          />
        </div>
        <div className="mt-4 space-y-3">
          {selectedNames.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedNames.map((name) => (
                <button key={name} type="button" className="rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary" onClick={() => setSelectedNames((names) => names.filter((item) => item !== name))}>
                  {name} 지우기
                </button>
              ))}
              <button type="button" className="rounded-full bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground" onClick={() => setSelectedNames([])}>전체 해제</button>
            </div>
          )}
          {normalizedQuery && filteredArchiveMembers.length > 0 && (
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-xl bg-primary/8 p-3">
              {filteredArchiveMembers.slice(0, 40).map((name) => {
                const selected = selectedNames.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", selected ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted")}
                    onClick={() => setSelectedNames((names) => (names.includes(name) ? names.filter((item) => item !== name) : [...names, name]))}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Panel>
      {mergeBase && (
        <Panel title="곡 병합">
          <div className="space-y-4">
            <div className="rounded-2xl bg-primary/10 p-4">
              <p className="text-sm font-semibold text-primary">기준 카드</p>
              <p className="mt-1 text-lg font-semibold">{splitOriginalTag(mergeBase.songTitle).title}{splitOriginalTag(mergeBase.songTitle).original && <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 align-middle text-xs text-white font-semibold text-amber-700">창작</span>}</p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">{mergeBase.performanceTitle} · 팀장 {mergeBase.leaderName || "미지정"}</p>
            </div>
            <input
              className="w-full rounded-xl bg-muted px-5 py-4 text-sm font-medium outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/30"
              value={mergeQuery}
              onChange={(event) => setMergeQuery(event.target.value)}
              placeholder="병합할 곡 검색"
            />
            <div className="grid max-h-80 gap-2 overflow-y-auto rounded-2xl bg-primary/8 p-3">
              {mergeCandidates.length === 0 && <p className="p-3 text-sm font-medium text-muted-foreground">병합할 곡을 찾지 못했습니다.</p>}
              {mergeCandidates.slice(0, 80).map((item) => {
                const selected = mergeSelectedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn("rounded-xl px-4 py-3 text-left transition", selected ? "bg-primary/15" : "bg-background hover:bg-background")}
                    onClick={() => setMergeSelectedIds((ids) => (ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id]))}
                  >
                    <p className="font-semibold">{splitOriginalTag(item.songTitle).title}{splitOriginalTag(item.songTitle).original && <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 align-middle text-xs text-white font-semibold text-amber-700">창작</span>}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">{item.performanceTitle} · 팀장 {item.leaderName || "미지정"}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" className="rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground disabled:opacity-45" disabled={mergeSelectedIds.length === 0} onClick={mergeArchiveSongs}>
                {mergeSelectedIds.length + 1}개 카드 병합
              </button>
              <button type="button" className="rounded-xl bg-background px-5 py-4 text-sm font-semibold shadow-sm" onClick={cancelMerge}>취소</button>
            </div>
          </div>
        </Panel>
      )}
      <Tabs tabs={[["all", "전체"], ...archiveYearTabs.map((year) => [String(year), `${String(year).slice(2)}년`] as const)]} value={yearTab} onChange={setYearTab} />
      <Panel title={`이력 목록 ${visibleArchives.length}개`}>
        <div className="grid gap-3">
          {visibleArchives.length === 0 && <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
          {visibleArchives.map(({ item, selectedMatchCount }) => {
            const team = data.teams.find((teamItem) => teamItem.id === item.teamId);
            return (
              <SwipeActions key={item.id} onEdit={() => beginArchiveEdit(item)} onDelete={() => deleteArchive(item)}>
              <div
                className="cursor-pointer rounded-2xl p-4 text-neutral-900 transition"
                style={{ backgroundColor: teamColor(team) }}
                onClick={() => handleArchiveClick(item)}
                onDoubleClick={() => handleArchiveDoubleClick(item)}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{splitOriginalTag(item.songTitle).title}{splitOriginalTag(item.songTitle).original && <span className="ml-2 rounded-full bg-neutral-900 px-2 py-0.5 align-middle text-xs text-white font-semibold text-amber-700">창작</span>}</p>
                    <p className="text-sm font-medium text-neutral-700">{item.performanceTitle} · 팀장 {item.leaderName || "미지정"}{item.durationSeconds ? ` · ${formatSongDuration(item.durationSeconds)}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedNames.length > 0 && <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">{selectedMatchCount}/{selectedNames.length}명 일치</span>}
                    <span className="w-fit rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-neutral-900">{archiveSourceLabel(item)}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.memberNames.map((name) => {
                    const user = data.users.find((candidate) => candidate.name === name);
                    return user ? <UserPill key={name} user={user} data={data} /> : <span key={name} className="rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-neutral-900">{name}</span>;
                  })}
                </div>
              </div>
              </SwipeActions>
            );
          })}
        </div>
      </Panel>
      {editingArchiveId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditingArchiveId("");
        }}>
          <section className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-background p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">곡 이력 수정</h3>
              <button type="button" className="rounded-full bg-muted px-4 py-2 text-sm font-semibold" onClick={() => setEditingArchiveId("")}>닫기</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="공연명" value={archiveForm.performanceTitle} onChange={(value) => setArchiveForm({ ...archiveForm, performanceTitle: value })} />
              <Field label="곡 / 무대 이름" value={archiveForm.songTitle} onChange={(value) => setArchiveForm({ ...archiveForm, songTitle: value })} />
              <Field label="곡 시간 (선택, 분:초)" value={archiveForm.duration} onChange={(value) => setArchiveForm({ ...archiveForm, duration: value })} placeholder="예: 3:30" />
              <Select label="소속 팀" value={archiveForm.teamId} onChange={(value) => setArchiveForm({ ...archiveForm, teamId: value })} options={data.teams.map((team) => [team.id, team.name])} />
            </div>
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="mb-3 text-sm font-semibold">참여 인원 / 팀장</p>
              <div className="grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
                {data.users.map((user) => {
                  const selected = archiveForm.memberNames.includes(user.name);
                  return (
                    <div key={user.id} className="flex items-center justify-between gap-2 rounded-xl bg-background p-2">
                      <UserPill user={user} data={data} />
                      <div className="flex gap-2">
                        <SoftCheckbox checked={selected} label="참여" onToggle={() => setArchiveForm((form) => {
                          const memberNames = selected ? form.memberNames.filter((name) => name !== user.name) : [...form.memberNames, user.name];
                          return { ...form, memberNames, leaderName: memberNames.includes(form.leaderName) ? form.leaderName : memberNames[0] ?? "" };
                        })} />
                        <SoftCheckbox checked={archiveForm.leaderName === user.name} label="팀장" onToggle={() => setArchiveForm((form) => ({ ...form, leaderName: user.name, memberNames: form.memberNames.includes(user.name) ? form.memberNames : [...form.memberNames, user.name] }))} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <PrimaryButton onClick={saveArchiveEdit}>수정 저장</PrimaryButton>
              <button
                type="button"
                className="rounded-xl bg-primary/12 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
                onClick={() => {
                  const itemId = editingArchiveId;
                  setEditingArchiveId("");
                  beginMerge(itemId);
                }}
              >
                다른 곡과 병합
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
