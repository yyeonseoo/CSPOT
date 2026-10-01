import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { currentTerm, nowIso, previousTerm, termLabel } from "@/lib/format";
import { fixSongLeaders } from "@/lib/local-data";
import { canManageTeams, canManageUsers, roleLabel } from "@/lib/permissions";
import { alpha, defaultAccent, fixedTeamColors, inkOn, isPastPerformance, palette, teamColor } from "@/lib/schedule";
import { cn, uid } from "@/lib/utils";
import type { AppData, ClubUser, Role, Team } from "@/types/domain";
import { DataList, Field, Panel, PrimaryButton, Select, Tabs } from "@/components/ui";

const roleOptions: Role[] = ["SUPER_ADMIN", "VICE_ADMIN", "TREASURER", "TEAM_ADMIN", "USER"];

const termsOf = (user: ClubUser) => user.activeTerms ?? [];

export function UsersPanel({ data, currentUser, persist }: { data: AppData; currentUser: ClubUser; persist: (data: AppData) => void }) {
  const [form, setForm] = useState({ name: "", teamId: data.teams[0]?.id ?? "", role: "USER" as Role });
  const [teamName, setTeamName] = useState("");
  const [selectedTerm, setSelectedTerm] = useState(currentTerm());
  const [selectedUserId, setSelectedUserId] = useState(data.users[0]?.id ?? "");
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [tab, setTab] = useState<"list" | "create" | "teams">("list");
  const termOptions = Array.from(new Set([...data.users.flatMap(termsOf), currentTerm()])).sort();
  const usersByTerm = data.users.filter((user) => termsOf(user).includes(selectedTerm));
  const prevTerm = previousTerm(selectedTerm);
  const [addQuery, setAddQuery] = useState("");
  const addCandidates = data.users.filter((user) => !termsOf(user).includes(selectedTerm) && user.name.includes(addQuery.trim()));
  const carryOverUsers = data.users.filter((user) => termsOf(user).includes(prevTerm) && !termsOf(user).includes(selectedTerm));
  const selectedUser = usersByTerm.find((user) => user.id === selectedUserId) ?? usersByTerm[0] ?? null;
  const selectedUserIndex = usersByTerm.findIndex((user) => user.id === selectedUserId);
  const shouldExpandMembers = showAllMembers || selectedUserIndex >= 5;
  const visibleUsers = shouldExpandMembers ? usersByTerm : usersByTerm.slice(0, 5);
  const allowed = canManageUsers(currentUser.role);

  function addTeam() {
    if (!teamName.trim() || !canManageTeams(currentUser.role)) return;
    const createdAt = nowIso();
    const team: Team = { id: uid("team"), name: teamName, color: fixedTeamColors[teamName] ?? palette[data.teams.length % palette.length], order: data.teams.length + 1, isActive: true, createdAt, updatedAt: createdAt };
    persist({ ...data, teams: [...data.teams, team] });
    setTeamName("");
  }

  function renameTeam(team: Team) {
    const name = window.prompt("새 팀 이름", team.name)?.trim();
    if (!name || name === team.name) return;
    if (data.teams.some((item) => item.id !== team.id && item.name === name)) {
      window.alert("같은 이름의 팀이 이미 있습니다.");
      return;
    }
    persist({ ...data, teams: data.teams.map((item) => item.id === team.id ? { ...item, name, updatedAt: nowIso() } : item)});
  }

  function deleteTeam(teamId: string) {
    const teamHasUsers = data.users.some((user) => user.teamId === teamId);
    const teamHasSongs = data.songs.some((song) => song.teamId === teamId);
    if (teamHasUsers || teamHasSongs) return;
    persist({ ...data, teams: data.teams.filter((team) => team.id !== teamId)});
  }

  function carryOver() {
    if (!window.confirm(`${termLabel(prevTerm)} 멤버 ${carryOverUsers.length}명을 ${termLabel(selectedTerm)}에 추가할까요?`)) return;
    const ids = new Set(carryOverUsers.map((user) => user.id));
    persist({ ...data, users: data.users.map((user) => ids.has(user.id) ? { ...user, activeTerms: [...termsOf(user), selectedTerm].sort(), updatedAt: nowIso() } : user) });
  }

  // 기존 멤버를 한 명씩 이 학기에 넣는다.
  function addToTerm(userId: string) {
    persist({ ...data, users: data.users.map((user) => user.id === userId ? { ...user, activeTerms: [...termsOf(user), selectedTerm].sort(), updatedAt: nowIso() } : user) });
    setSelectedUserId(userId);
  }

  // 계정은 남기고 선택한 학기에서만 모두 뺀다.
  function clearTerm() {
    if (!window.confirm(`${termLabel(selectedTerm)} 명단에서 ${usersByTerm.length}명을 모두 뺄까요? 계정과 다른 학기 기록은 그대로 남습니다.`)) return;
    persist({ ...data, users: data.users.map((user) => termsOf(user).includes(selectedTerm) ? { ...user, activeTerms: termsOf(user).filter((term) => term !== selectedTerm), updatedAt: nowIso() } : user) });
  }

  function createUser() {
    const name = form.name.trim();
    if (!allowed || !name) return;
    // 이름으로 로그인하므로 같은 이름은 새로 만들지 않고, 기존 멤버를 이 학기에 넣는다.
    const existing = data.users.find((user) => user.name === name);
    if (existing) {
      if (!termsOf(existing).includes(selectedTerm)) addToTerm(existing.id);
      setForm({ ...form, name: "" });
      return;
    }
    const team = data.teams.find((item) => item.id === form.teamId);
    const createdAt = nowIso();
    const user: ClubUser = {
      id: uid("user"),
      ...form,
      name,
      username: name,
      password: "",
      teamId: form.teamId || null,
      teamColor: team?.color ?? defaultAccent,
      performanceColors: {},
      activeTerms: [selectedTerm],
      mustChangePassword: false,
      status: "ACTIVE",
      createdAt,
      updatedAt: createdAt,
    };
    persist({ ...data, users: [...data.users, user] });
    setForm({ name: "", teamId: data.teams[0]?.id ?? "", role: "USER" });
    setSelectedUserId(user.id);
    if (data.users.length >= 5) setShowAllMembers(true);
    setTab("list");
  }

  return (
    <section className="space-y-4">
      <Tabs tabs={[["list", "멤버 목록"], ["create", "멤버 추가"], ["teams", "소속 팀"]]} value={tab} onChange={setTab} />
      {tab === "teams" && (
        <Panel title="소속 팀">
          <Field label="팀 이름" value={teamName} onChange={setTeamName} />
          <PrimaryButton className="mt-3" disabled={!canManageTeams(currentUser.role)} onClick={addTeam}>생성</PrimaryButton>
          <div className="mt-4 space-y-2">
            {data.teams.map((team) => {
              const canDelete = !data.users.some((user) => user.teamId === team.id) && !data.songs.some((song) => song.teamId === team.id);
              return (
                <div key={team.id} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium" style={{ backgroundColor: teamColor(team), color: inkOn(teamColor(team)) }}>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: teamColor(team) }} />{team.name}</span>
                  <span className="flex gap-3">
                    <button className="text-xs font-medium opacity-80" onClick={() => renameTeam(team)}>이름 변경</button>
                    <button className="text-xs opacity-70 disabled:opacity-30" disabled={!canDelete} title={canDelete ? "" : "소속 멤버나 곡이 있으면 삭제할 수 없습니다"} onClick={() => deleteTeam(team.id)}>삭제</button>
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
      {tab === "create" && (
        <Panel title="멤버 추가">
          <div className="space-y-3">
            <Field label="이름" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
            <Select label="소속 팀" value={form.teamId} onChange={(value) => setForm({ ...form, teamId: value })} options={data.teams.map((team) => [team.id, team.name])} />
            {currentUser.role === "SUPER_ADMIN" && <Select label="직책" value={form.role} onChange={(value) => setForm({ ...form, role: value as Role })} options={roleOptions.map((role) => [role, roleLabel(role)])} />}
            <PrimaryButton onClick={createUser} disabled={!allowed} icon={<Plus size={17} />}>생성</PrimaryButton>
          </div>
        </Panel>
      )}
      {tab === "list" && (
      <div className="space-y-4">
        <Panel title="멤버 목록">
          <div className="mb-4 flex flex-wrap gap-2">
            {termOptions.map((term) => {
              const count = data.users.filter((user) => termsOf(user).includes(term)).length;
              const selected = selectedTerm === term;
              return (
                <button
                  key={term}
                  type="button"
                  className={cn("rounded-xl px-3.5 py-2.5 text-left transition", selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
                  onClick={() => {
                    setSelectedTerm(term);
                    setShowAllMembers(false);
                  }}
                >
                  <p className="font-semibold">{termLabel(term)}</p>
                  <p className="mt-1 text-xs font-medium opacity-80">{count}명</p>
                </button>
              );
            })}
          </div>
          {carryOverUsers.length > 0 && (
            <button type="button" className="mb-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-foreground" onClick={carryOver}>
              {termLabel(prevTerm)} 멤버 {carryOverUsers.length}명 불러오기
            </button>
          )}
          <div className="mb-4 space-y-2">
            <input
              className="w-full rounded-xl bg-muted px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-primary/20"
              value={addQuery}
              onChange={(event) => setAddQuery(event.target.value)}
              placeholder="기존 멤버 이름으로 이 학기에 추가"
            />
            {addQuery.trim() && (
              <div className="space-y-1.5">
                {addCandidates.length === 0 && <p className="px-1 text-sm text-muted-foreground">추가할 멤버가 없습니다.</p>}
                {addCandidates.slice(0, 8).map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-2 rounded-xl bg-background px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-medium">{user.name} <span className="text-muted-foreground">{termsOf(user).map(termLabel).join(", ") || "학기 없음"}</span></span>
                    <button type="button" className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground" onClick={() => addToTerm(user.id)}>추가</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {usersByTerm.length === 0 && <p className="text-sm text-muted-foreground">이 학기에 등록된 멤버가 없습니다.</p>}
          {usersByTerm.length > 0 && (
            <button type="button" className="mb-4 w-full rounded-full px-4 py-2.5 text-sm font-semibold text-destructive" onClick={clearTerm}>
              {termLabel(selectedTerm)} 명단 비우기
            </button>
          )}
          <div className="grid gap-3">
            {visibleUsers.map((user) => {
              const team = data.teams.find((item) => item.id === user.teamId);
              const color = teamColor(team);
              const selected = selectedUserId === user.id;
              return (
                <button
                  key={user.id}
                  className={cn("relative overflow-hidden rounded-xl p-4 pl-5 text-left transition", selected ? "shadow-sm" : "bg-background")}
                  style={selected ? { backgroundColor: alpha(color, "2E") } : undefined}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: color }} />
                  <p className="font-semibold">{user.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{roleLabel(user.role)} · {team?.name ?? "팀 없음"}</p>
                </button>
              );
            })}
          </div>
          {usersByTerm.length > 5 && (
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted"
              onClick={() => setShowAllMembers((value) => !value)}
            >
              {shouldExpandMembers ? "접기" : `더보기 ${usersByTerm.length - 5}명`}
            </button>
          )}
        </Panel>
        {selectedUser && <MemberDetailPanel data={data} user={selectedUser} termOptions={termOptions} canEditRole={currentUser.role === "SUPER_ADMIN"} persist={persist} />}
      </div>
      )}
    </section>
  );
}

function MemberDetailPanel({ data, user, termOptions, canEditRole, persist }: { data: AppData; user: ClubUser; termOptions: string[]; canEditRole: boolean; persist: (data: AppData) => void }) {
  const [form, setForm] = useState({ name: user.name, teamId: user.teamId ?? "", role: user.role, activeTerms: termsOf(user) });
  const joinedSongIds = data.songMembers.filter((member) => member.userId === user.id).map((member) => member.songId);
  // 끝나지 않은 공연의 곡만. 지난 곡은 과거 공연 이력에서 본다.
  const joinedSongs = data.songs.filter((song) => {
    const performance = data.performances.find((item) => item.id === song.performanceId);
    return joinedSongIds.includes(song.id) && Boolean(performance) && !isPastPerformance(performance!);
  });

  useEffect(() => {
    setForm({ name: user.name, teamId: user.teamId ?? "", role: user.role, activeTerms: termsOf(user) });
  }, [user]);

  function save() {
    const name = form.name.trim();
    if (!name || data.users.some((item) => item.id !== user.id && item.name === name)) return;
    const team = data.teams.find((item) => item.id === form.teamId);
    persist({
      ...data,
      users: data.users.map((item) =>
        item.id === user.id
          ? { ...item, ...form, name, role: canEditRole ? form.role as Role : item.role, teamId: form.teamId || null, teamColor: item.teamColor || team?.color || defaultAccent, updatedAt: nowIso() }
          : item,
      ),
    });
  }

  function deleteMember() {
    const ok = window.confirm(`${user.name} 멤버를 삭제할까요? 참여 곡과 일정 응답에서도 함께 제거됩니다.`);
    if (!ok) return;
    persist(fixSongLeaders({
      ...data,
      users: data.users.filter((item) => item.id !== user.id),
      performances: data.performances.map((performance) => ({ ...performance, memberIds: performance.memberIds.filter((memberId) => memberId !== user.id), updatedAt: nowIso() })),
      songMembers: data.songMembers.filter((member) => member.userId !== user.id),
      availabilityResponses: data.availabilityResponses.filter((response) => response.userId !== user.id),
      schedules: data.schedules.filter((schedule) => schedule.ownerUserId !== user.id),
    }));
  }

  function toggleTerm(term: string) {
    setForm((current) => ({
      ...current,
      activeTerms: current.activeTerms.includes(term) ? current.activeTerms.filter((item) => item !== term) : [...current.activeTerms, term].sort(),
    }));
  }

  return (
    <Panel title={`${user.name} 상세`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <Field label="이름" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Select label="소속 팀" value={form.teamId} onChange={(value) => setForm({ ...form, teamId: value })} options={data.teams.map((team) => [team.id, team.name])} />
          {canEditRole && <Select label="직책" value={form.role} onChange={(value) => setForm({ ...form, role: value as Role })} options={roleOptions.map((role) => [role, roleLabel(role)])} />}
          <div className="space-y-2">
            <p className="text-sm font-semibold">활동 학기</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {termOptions.map((term) => {
                const selected = form.activeTerms.includes(term);
                return (
                  <button
                    key={term}
                    type="button"
                    className={cn("rounded-xl px-3 py-3 text-sm font-semibold transition", selected ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}
                    onClick={() => toggleTerm(term)}
                  >
                    {termLabel(term)}
                  </button>
                );
              })}
            </div>
          </div>
          <PrimaryButton onClick={save}>수정 저장</PrimaryButton>
          <button type="button" className="w-full rounded-xl bg-background px-4 py-3 text-sm font-semibold text-red-500 shadow-sm transition hover:bg-red-50" onClick={deleteMember}>
            멤버 삭제
          </button>
        </div>
        <DataList title="참여 중인 곡" items={joinedSongs.map((song) => ({ id: song.id, title: song.title, meta: `${data.performances.find((performance) => performance.id === song.performanceId)?.title ?? "공연 없음"} · ${data.teams.find((team) => team.id === song.teamId)?.name ?? "팀 없음"}` }))} />
      </div>
    </Panel>
  );
}
