import { Check } from "lucide-react";
import { useState } from "react";
import { formatDateTime, formatSongDuration, nowIso } from "@/lib/format";
import { createAudit } from "@/lib/local-data";
import { findPracticeConflicts, performanceColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, PracticeCandidate, Schedule } from "@/types/domain";
import { UserPill } from "@/components/items";
import { Panel, PrimaryButton } from "@/components/ui";

export function SongManagementPanel({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const pending = data.practiceCandidates.filter((candidate) => candidate.status === "PENDING");
  const sortedPending = pending.slice().sort((a, b) => b.availableMemberCount - a.availableMemberCount || a.startsAt.localeCompare(b.startsAt));
  const grouped = data.performances.map((performance) => ({ performance, songs: data.songs.filter((song) => song.performanceId === performance.id) })).filter((group) => group.songs.length > 0);
  const selectedSong = data.songs.find((song) => song.id === selectedSongId) ?? null;
  const selectedSongMembers = selectedSong
    ? data.songMembers
      .filter((member) => member.songId === selectedSong.id)
      .map((member) => data.users.find((user) => user.id === member.userId))
      .filter((user): user is ClubUser => Boolean(user))
    : [];
  const conflicts = findPracticeConflicts(pending, data);

  function approveRequest(candidate: PracticeCandidate) {
    const song = data.songs.find((item) => item.id === candidate.songId);
    if (!song) return;
    const updatedAt = nowIso();
    const approved = { ...candidate, status: "APPROVED" as const, reviewedBy: currentUser.id, reviewedAt: updatedAt, updatedAt };
    const schedule: Schedule = { id: uid("schedule"), type: "PRACTICE", title: candidate.title || `${song.title} 연습`, startsAt: candidate.startsAt, endsAt: candidate.endsAt, performanceId: song.performanceId, songId: song.id, visibility: "MEMBERS_ONLY", status: "CONFIRMED", createdBy: currentUser.id, createdAt: updatedAt, updatedAt };
    persist({ ...data, practiceCandidates: data.practiceCandidates.map((item) => item.id === candidate.id ? approved : item), schedules: [...data.schedules, schedule], auditLogs: [...data.auditLogs, createAudit(currentUser, "APPROVE_SCHEDULE", "practiceCandidates", candidate.id, approved)] });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {grouped.map(({ performance, songs }) => (
          <Panel key={performance.id} title={performance.title}>
            <div className="grid gap-3 md:grid-cols-2">
              {songs.map((song) => {
                const memberCount = data.songMembers.filter((member) => member.songId === song.id).length;
                return (
                <button key={song.id} className={cn("rounded-[1.2rem] border p-4 text-left", selectedSongId === song.id ? "border-primary bg-primary/10" : "border-white/80 bg-card/70 dark:border-white/10")} onClick={() => setSelectedSongId(selectedSongId === song.id ? null : song.id)}>
                  <span className="mb-3 block h-2 w-12 rounded-full" style={{ backgroundColor: performanceColor(performance, currentUser) }} />
                  <p className="font-black">{song.title}</p>
                  <p className="text-sm text-muted-foreground">인원 {memberCount}명 · 대기 요청 {pending.filter((item) => item.songId === song.id).length}개{song.durationSeconds ? ` · ${formatSongDuration(song.durationSeconds)}` : ""}</p>
                </button>
                );
              })}
            </div>
          </Panel>
        ))}
        {selectedSong && (
          <Panel title={`${selectedSong.title} 참여 인원`}>
            <p className="mb-4 text-sm font-bold text-muted-foreground">
              팀장 {data.users.find((user) => user.id === selectedSong.leaderUserId)?.name ?? "미지정"}
              {selectedSong.durationSeconds ? ` · 곡 시간 ${formatSongDuration(selectedSong.durationSeconds)}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedSongMembers.map((user) => <UserPill key={user.id} user={user} data={data} />)}
              {selectedSongMembers.length === 0 && <p className="text-sm text-muted-foreground">등록된 참여 인원이 없습니다.</p>}
            </div>
          </Panel>
        )}
      </div>
      <aside className="space-y-5">
        <Panel title="전체 연습 요청">
          <div className="space-y-3">
            {sortedPending.length === 0 && <p className="text-sm text-muted-foreground">승인 대기 중인 연습 일정이 없습니다.</p>}
            {sortedPending.map((request) => {
              const song = data.songs.find((item) => item.id === request.songId);
              const performance = data.performances.find((item) => item.id === song?.performanceId);
              const selected = selectedSong?.id === request.songId;
              return (
              <div key={request.id} className={cn("rounded-[1.1rem] border p-3", selected ? "border-primary bg-primary/10" : "border-white/70 bg-muted/55 dark:border-white/10")}>
                <p className="font-black">{request.title || "연습 요청"}</p>
                <p className="text-sm text-muted-foreground">{performance?.title ?? "공연 없음"} · {song?.title ?? "곡 없음"}</p>
                <p className="text-sm text-muted-foreground">{formatDateTime(request.startsAt)} - {formatDateTime(request.endsAt)} · 가능 {request.availableMemberCount}/{request.totalMemberCount}명</p>
                {request.memo && <p className="mt-1 text-sm">{request.memo}</p>}
                <PrimaryButton className="mt-3" onClick={() => approveRequest(request)}><Check size={16} />확정</PrimaryButton>
              </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="충돌 정리">
          <div className="space-y-3">
            {conflicts.length === 0 && <p className="text-sm text-muted-foreground">타팀과 겹치는 대기 요청이 없습니다.</p>}
            {conflicts.map((conflict) => (
              <div key={`${conflict.first.id}-${conflict.second.id}`} className="rounded-[1.1rem] bg-muted/55 p-3 text-sm">
                <p className="font-black">{formatDateTime(conflict.startsAt)} - {formatDateTime(conflict.endsAt)}</p>
                <div className="mt-2 grid gap-2">
                  {[conflict.first, conflict.second].map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/55 p-3">
                      <p className="font-black">{item.performanceTitle} · {item.songTitle}</p>
                      <p className="text-muted-foreground">팀 {item.teamName} · 가능 {item.availableMemberCount}/{item.totalMemberCount}명</p>
                    </div>
                  ))}
                </div>
                <p className={cn("mt-2 rounded-xl px-3 py-2 font-bold", conflict.sharedMemberCount >= 2 ? "bg-destructive/10 text-destructive" : "bg-primary/15 text-primary")}>
                  겹치는 인원 {conflict.sharedMemberCount}명 · {conflict.sharedMemberCount >= 2 ? "동시 확정 비추천" : "동시 확정 가능"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </section>
  );
}
