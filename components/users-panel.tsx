import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { nowIso } from "@/lib/format";
import { createAudit } from "@/lib/local-data";
import { canManageTeams, canManageUsers, roleLabel } from "@/lib/permissions";
import { alpha, defaultBlue, fixedTeamColors, palette, teamColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, Role, Team } from "@/types/domain";
import { DataList, Field, Panel, PrimaryButton, Select } from "@/components/ui";

const roleOptions: Role[] = ["SUPER_ADMIN", "VICE_ADMIN", "TREASURER", "TEAM_ADMIN", "USER"];

export function UsersPanel({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const [form, setForm] = useState({ name: "", username: "", password: "", teamId: data.teams[0]?.id ?? "", role: "USER" as Role });
  const [teamName, setTeamName] = useState("");
  const [selectedYear, setSelectedYear] = useState<2025 | 2026>(2026);
  const [selectedUserId, setSelectedUserId] = useState(data.users[0]?.id ?? "");
  const [showAllMembers, setShowAllMembers] = useState(false);
  const usersByYear = data.users.filter((user) => (user.activeYears ?? [2026]).includes(selectedYear));
  const selectedUser = usersByYear.find((user) => user.id === selectedUserId) ?? usersByYear[0] ?? null;
  const selectedUserIndex = usersByYear.findIndex((user) => user.id === selectedUserId);
  const shouldExpandMembers = showAllMembers || selectedUserIndex >= 5;
  const visibleUsers = shouldExpandMembers ? usersByYear : usersByYear.slice(0, 5);
  const allowed = canManageUsers(currentUser.role);

  function addTeam() {
    if (!teamName.trim() || !canManageTeams(currentUser.role)) return;
    const createdAt = nowIso();
    const team: Team = { id: uid("team"), name: teamName, color: fixedTeamColors[teamName] ?? palette[data.teams.length % palette.length], order: data.teams.length + 1, isActive: true, createdAt, updatedAt: createdAt };
    persist({ ...data, teams: [...data.teams, team], auditLogs: [...data.auditLogs, createAudit(currentUser, "CREATE_TEAM", "teams", team.id, team)] });
    setTeamName("");
  }

  function deleteTeam(teamId: string) {
    const teamHasUsers = data.users.some((user) => user.teamId === teamId);
    const teamHasSongs = data.songs.some((song) => song.teamId === teamId);
    if (teamHasUsers || teamHasSongs) return;
    persist({ ...data, teams: data.teams.filter((team) => team.id !== teamId), auditLogs: [...data.auditLogs, createAudit(currentUser, "DELETE_TEAM", "teams", teamId)] });
  }

  function createUser() {
    if (!allowed || !form.name || !form.username || !form.password) return;
    const team = data.teams.find((item) => item.id === form.teamId);
    const createdAt = nowIso();
    const user: ClubUser = {
      id: uid("user"),
      ...form,
      teamId: form.teamId || null,
      teamColor: team?.color ?? defaultBlue,
      performanceColors: {},
      activeYears: [2026],
      mustChangePassword: true,
      status: "ACTIVE",
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, users: [...data.users, user], auditLogs: [...data.auditLogs, createAudit(currentUser, "CREATE_USER", "users", user.id, user)] });
    setForm({ name: "", username: "", password: "", teamId: data.teams[0]?.id ?? "", role: "USER" });
    setSelectedUserId(user.id);
    if (data.users.length >= 5) setShowAllMembers(true);
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <Panel title="소속 팀 만들기">
          <Field label="팀 이름" value={teamName} onChange={setTeamName} />
          <PrimaryButton className="mt-3" disabled={!canManageTeams(currentUser.role)} onClick={addTeam}>생성</PrimaryButton>
          <div className="mt-4 space-y-2">
            {data.teams.map((team) => {
              const canDelete = !data.users.some((user) => user.teamId === team.id) && !data.songs.some((song) => song.teamId === team.id);
              return (
                <div key={team.id} className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-bold" style={{ backgroundColor: alpha(teamColor(team), "3D") }}>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor(team) }} />{team.name}</span>
                  <button className="text-xs text-muted-foreground disabled:opacity-40" disabled={!canDelete} onClick={() => deleteTeam(team.id)}>삭제</button>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="멤버 생성">
          <div className="space-y-3">
            <Field label="이름" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Field label="아이디" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
            <Field label="초기 비밀번호" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
            <Select label="소속 팀" value={form.teamId} onChange={(value) => setForm({ ...form, teamId: value })} options={data.teams.map((team) => [team.id, team.name])} />
            <Select label="직책" value={form.role} onChange={(value) => setForm({ ...form, role: value as Role })} options={roleOptions.map((role) => [role, roleLabel(role)])} />
            <PrimaryButton onClick={createUser} disabled={!allowed} icon={<Plus size={17} />}>생성</PrimaryButton>
          </div>
        </Panel>
      </div>
      <div className="space-y-5">
        <Panel title="멤버 목록">
          <div className="mb-4 grid grid-cols-2 gap-3">
            {[2025, 2026].map((year) => {
              const count = data.users.filter((user) => (user.activeYears ?? [2026]).includes(year)).length;
              const selected = selectedYear === year;
              return (
                <button
                  key={year}
                  type="button"
                  className={cn("rounded-2xl px-4 py-3 text-left transition", selected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/70 text-muted-foreground")}
                  onClick={() => {
                    setSelectedYear(year as 2025 | 2026);
                    setShowAllMembers(false);
                  }}
                >
                  <p className="text-lg font-black">{String(year).slice(2)}년</p>
                  <p className="mt-1 text-xs font-bold opacity-80">{count}명</p>
                </button>
              );
            })}
          </div>
          <div className="grid gap-3">
            {visibleUsers.map((user) => {
              const team = data.teams.find((item) => item.id === user.teamId);
              const color = teamColor(team);
              const selected = selectedUserId === user.id;
              return (
                <button
                  key={user.id}
                  className={cn("relative overflow-hidden rounded-[1.1rem] border p-4 pl-5 text-left transition hover:-translate-y-0.5", selected ? "shadow-sm" : "border-white/80 bg-card/68 dark:border-white/10")}
                  style={selected ? { borderColor: color, backgroundColor: alpha(color, "2E") } : undefined}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: color }} />
                  <p className="font-black">{user.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{user.username} · {roleLabel(user.role)} · {team?.name ?? "팀 없음"}</p>
                </button>
              );
            })}
          </div>
          {usersByYear.length > 5 && (
            <button
              type="button"
              className="mt-4 w-full rounded-2xl bg-muted/70 px-4 py-3 text-sm font-black text-muted-foreground transition hover:bg-muted"
              onClick={() => setShowAllMembers((value) => !value)}
            >
              {shouldExpandMembers ? "접기" : `더보기 ${usersByYear.length - 5}명`}
            </button>
          )}
        </Panel>
        {selectedUser && <MemberDetailPanel data={data} user={selectedUser} persist={persist} />}
      </div>
    </section>
  );
}

function MemberDetailPanel({ data, user, persist }: { data: AppData; user: ClubUser; persist: (data: AppData) => void }) {
  const [form, setForm] = useState({ name: user.name, username: user.username, password: user.password, teamId: user.teamId ?? "", role: user.role, activeYears: user.activeYears ?? [2026] });
  const joinedSongIds = data.songMembers.filter((member) => member.userId === user.id).map((member) => member.songId);
  const joinedSongs = data.songs.filter((song) => joinedSongIds.includes(song.id));

  useEffect(() => {
    setForm({ name: user.name, username: user.username, password: user.password, teamId: user.teamId ?? "", role: user.role, activeYears: user.activeYears ?? [2026] });
  }, [user]);

  function save() {
    const team = data.teams.find((item) => item.id === form.teamId);
    persist({
      ...data,
      users: data.users.map((item) =>
        item.id === user.id
          ? { ...item, ...form, activeYears: form.activeYears.length > 0 ? form.activeYears : [2026], role: form.role as Role, teamId: form.teamId || null, teamColor: item.teamColor || team?.color || defaultBlue, updatedAt: nowIso() }
          : item,
      ),
    });
  }

  function deleteMember() {
    const ok = window.confirm(`${user.name} 멤버를 삭제할까요? 참여 곡과 일정 응답에서도 함께 제거됩니다.`);
    if (!ok) return;
    persist({
      ...data,
      users: data.users.filter((item) => item.id !== user.id),
      performances: data.performances.map((performance) => ({ ...performance, memberIds: performance.memberIds.filter((memberId) => memberId !== user.id), updatedAt: nowIso() })),
      songMembers: data.songMembers.filter((member) => member.userId !== user.id),
      availabilityResponses: data.availabilityResponses.filter((response) => response.userId !== user.id),
      ambiguousTimes: data.ambiguousTimes.filter((time) => time.userId !== user.id),
      schedules: data.schedules.filter((schedule) => schedule.ownerUserId !== user.id),
    });
  }

  function toggleActiveYear(year: number) {
    setForm((current) => ({
      ...current,
      activeYears: current.activeYears.includes(year) ? current.activeYears.filter((item) => item !== year) : [...current.activeYears, year].sort(),
    }));
  }

  return (
    <Panel title={`${user.name} 상세`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="이름" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Field label="아이디" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
          <Field label="비밀번호" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
          <Select label="소속 팀" value={form.teamId} onChange={(value) => setForm({ ...form, teamId: value })} options={data.teams.map((team) => [team.id, team.name])} />
          <Select label="직책" value={form.role} onChange={(value) => setForm({ ...form, role: value as Role })} options={roleOptions.map((role) => [role, roleLabel(role)])} />
          <div className="space-y-2">
            <p className="text-sm font-black">활동 연도</p>
            <div className="grid grid-cols-2 gap-2">
              {[2025, 2026].map((year) => {
                const selected = form.activeYears.includes(year);
                return (
                  <button
                    key={year}
                    type="button"
                    className={cn("rounded-2xl px-4 py-3 text-sm font-black transition", selected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-white/70 text-muted-foreground")}
                    onClick={() => toggleActiveYear(year)}
                  >
                    {String(year).slice(2)}년 활동
                  </button>
                );
              })}
            </div>
          </div>
          <PrimaryButton onClick={save}>수정 저장</PrimaryButton>
          <button type="button" className="w-full rounded-2xl bg-white/70 px-4 py-3 text-sm font-black text-red-500 shadow-sm transition hover:bg-red-50" onClick={deleteMember}>
            멤버 삭제
          </button>
        </div>
        <DataList title="참여 중인 곡" items={joinedSongs.map((song) => ({ id: song.id, title: song.title, meta: `${data.performances.find((performance) => performance.id === song.performanceId)?.title ?? "공연 없음"} · ${data.teams.find((team) => team.id === song.teamId)?.name ?? "팀 없음"}` }))} />
      </div>
    </Panel>
  );
}
