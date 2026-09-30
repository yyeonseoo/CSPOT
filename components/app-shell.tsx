import { Archive, CalendarDays, ClipboardList, LogOut, Megaphone, Menu, Moon, Music2, Settings, Sun, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { isAdminRole, roleLabel } from "@/lib/permissions";
import type { Portal } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser } from "@/types/domain";
import { ArchivePanel } from "@/components/archive-panel";
import { AuditPanel } from "@/components/audit-panel";
import { CalendarPanel } from "@/components/calendar-panel";
import { MyPagePanel } from "@/components/my-page-panel";
import { NoticePanel } from "@/components/notice-panel";
import { PerformanceManager } from "@/components/performance-manager";
import { SongManagementPanel } from "@/components/song-management-panel";
import { LeaderPanel, SurveyPanel } from "@/components/survey-panel";
import { UsersPanel } from "@/components/users-panel";

type NavItem = [string, string, LucideIcon];

export function AppShell({
  data,
  currentUser,
  portal,
  persist,
  logout,
  dark,
  toggleTheme,
  switchSession,
}: {
  data: AppData;
  currentUser: ClubUser;
  portal: Portal;
  persist: (data: AppData) => void;
  logout: () => void;
  dark: boolean;
  toggleTheme: () => void;
  switchSession: (userId: string, portal: Portal) => void;
}) {
  const adminMode = portal === "admin" && isAdminRole(currentUser.role);
  const [view, setView] = useState("calendar");
  const [menuOpen, setMenuOpen] = useState(false);
  const leaderIds = new Set(data.songs.map((song) => song.leaderUserId));
  const nav: NavItem[] = adminMode
    ? [
        ["calendar", "캘린더", CalendarDays],
        ["users", "멤버", Users],
        ["performances", "공연 관리", Music2],
        ["songs", "연습 일정 관리", ClipboardList],
        ["archive", "과거 공연 이력", Archive],
        ["notices", "공지", Megaphone],
        ["audit", "로그", ClipboardList],
        ["mypage", "마이", Settings],
      ]
    : [
        ["calendar", "캘린더", CalendarDays],
        ["surveys", "조사", ClipboardList],
        // 곡팀장인 사람에게만 보이는 탭
        ...(leaderIds.has(currentUser.id) ? [["leader", "곡팀장", Music2] as NavItem] : []),
        ["notices-user", "공지", Megaphone],
        ["mypage", "마이", Settings],
      ];

  return (
    <main className="soft-shell min-h-screen">
      {menuOpen && <button type="button" aria-label="메뉴 닫기" className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMenuOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 border-r border-border bg-background p-4 transition-transform md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 border-b border-border px-2 pb-4">
          <p className="text-sm font-semibold">Club Scheduler</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{adminMode ? "관리자" : "사용자"}</p>
        </div>
        <nav className="space-y-1">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={cn(
                "flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition",
                view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              onClick={() => { setView(id); setMenuOpen(false); }}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="pb-20 md:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background/95 px-4 pb-2 pt-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button className="rounded-xl p-2 hover:bg-muted md:hidden" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {currentUser.name} ({roleLabel(currentUser.role)}){adminMode && " 관리자 화면"}
              </p>
              <h2 className="truncate text-2xl font-bold tracking-tight">{view === "calendar" ? "이번 달 일정" : nav.find(([id]) => id === view)?.[1]}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="rounded-xl p-2 text-muted-foreground hover:bg-muted" onClick={toggleTheme} aria-label="테마 변경">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="rounded-xl p-2 text-muted-foreground hover:bg-muted" onClick={logout} aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="px-3 pb-4 pt-1 sm:p-6">
          {view === "calendar" && <CalendarPanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
          {view === "users" && <UsersPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "performances" && <PerformanceManager data={data} currentUser={currentUser} persist={persist} />}
          {view === "songs" && <SongManagementPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "archive" && <ArchivePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "notices" && <NoticePanel data={data} currentUser={currentUser} persist={persist} admin />}
          {view === "audit" && <AuditPanel data={data} />}
          {view === "surveys" && <SurveyPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "leader" && <LeaderPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "notices-user" && <NoticePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "mypage" && <MyPagePanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
        </div>
      </section>

      {/* 테스트용 계정 전환 바. 비밀번호 없이 아무 계정으로나 들어가므로 개발 서버(npm run dev)에서만 보인다. */}
      {process.env.NODE_ENV !== "production" && (
      <label className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-2 border-t border-border bg-background px-3 py-2 text-xs font-semibold md:left-64 dark:border-border">
        <span className="shrink-0 text-muted-foreground">테스트 계정</span>
        <select
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-base font-medium dark:border-border"
          value={`${currentUser.id}|${adminMode ? "admin" : "user"}`}
          onChange={(event) => {
            const [userId, nextPortal] = event.target.value.split("|");
            switchSession(userId, nextPortal as Portal);
          }}
        >
          <optgroup label="관리자">
            {data.users.filter((user) => isAdminRole(user.role)).map((user) => <option key={user.id} value={`${user.id}|admin`}>{user.name} ({roleLabel(user.role)})</option>)}
          </optgroup>
          <optgroup label="곡팀장">
            {data.users.filter((user) => leaderIds.has(user.id)).map((user) => <option key={user.id} value={`${user.id}|user`}>{user.name} ({data.songs.filter((song) => song.leaderUserId === user.id).map((song) => song.title).join(", ")})</option>)}
          </optgroup>
          <optgroup label="일반 팀원">
            {data.users.filter((user) => !leaderIds.has(user.id)).map((user) => <option key={user.id} value={`${user.id}|user`}>{user.name}</option>)}
          </optgroup>
        </select>
      </label>
      )}
    </main>
  );
}
