import { Archive, CalendarDays, ClipboardList, LogOut, Megaphone, Menu, Music2, Settings, Ticket, Users, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { isAdminRole, roleLabel } from "@/lib/permissions";
import { activeLeaderSongs } from "@/lib/schedule";
import type { Portal } from "@/lib/session";
import { cn } from "@/lib/utils";
import type { AppData, ClubUser } from "@/types/domain";
import { ArchivePanel } from "@/components/archive-panel";
import { CalendarPanel } from "@/components/calendar-panel";
import { MyPagePanel } from "@/components/my-page-panel";
import { NoticePanel } from "@/components/notice-panel";
import { PerformanceManager } from "@/components/performance-manager";
import { PerformanceView } from "@/components/performance-view";
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
}: {
  data: AppData;
  currentUser: ClubUser;
  portal: Portal;
  persist: (data: AppData) => void;
  logout: () => void;
}) {
  const adminMode = portal === "admin" && isAdminRole(currentUser.role);
  const [view, setView] = useState("calendar");
  const [menuOpen, setMenuOpen] = useState(false);
  const nav: NavItem[] = adminMode
    ? [
        ["calendar", "캘린더", CalendarDays],
        ["users", "멤버", Users],
        ["performances", "공연 관리", Music2],
        ["songs", "연습 일정 관리", ClipboardList],
        ["archive", "과거 공연 이력", Archive],
        ["notices", "공지", Megaphone],
        ["mypage", "마이", Settings],
      ]
    : [
        ["calendar", "캘린더", CalendarDays],
        ["surveys", "조사", ClipboardList],
        // 곡팀장인 사람에게만 보이는 탭
        ...(activeLeaderSongs(currentUser.id, data).length > 0 ? [["leader", "곡팀장", Music2] as NavItem] : []),
        ["performances-user", "공연", Ticket],
        ["notices-user", "공지", Megaphone],
        ["mypage", "마이", Settings],
      ];

  return (
    <main className="soft-shell min-h-screen">
      {menuOpen && <button type="button" aria-label="메뉴 닫기" className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMenuOpen(false)} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-64 bg-card p-4 transition-transform md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-4 px-2 pb-4">
          <p className="text-sm font-semibold">CSPOT</p>
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

      <section className="pb-6 md:ml-64">
        <header className="page-bar sticky top-0 z-10 flex items-center justify-between gap-2 px-4 pb-2 pt-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <button className="rounded-xl p-2 hover:bg-black/10 md:hidden" onClick={() => setMenuOpen(true)} aria-label="메뉴 열기">
              <Menu size={18} />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs opacity-70">
                {currentUser.name} ({roleLabel(currentUser.role)}){adminMode && " 관리자 화면"}
              </p>
              <h2 className="truncate text-2xl font-bold tracking-tight">{nav.find(([id]) => id === view)?.[1]}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="rounded-xl p-2 opacity-70 hover:bg-black/10" onClick={logout} aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="px-3 pb-4 pt-1 sm:p-6">
          {view === "calendar" && <CalendarPanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
          {view === "users" && <UsersPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "performances" && <PerformanceManager data={data} currentUser={currentUser} persist={persist} />}
          {view === "songs" && <SongManagementPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "archive" && <ArchivePanel data={data} persist={persist} />}
          {view === "notices" && <NoticePanel data={data} currentUser={currentUser} persist={persist} admin />}
          {view === "surveys" && <SurveyPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "leader" && <LeaderPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "performances-user" && <PerformanceView data={data} />}
          {view === "notices-user" && <NoticePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "mypage" && <MyPagePanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
        </div>
      </section>

    </main>
  );
}
