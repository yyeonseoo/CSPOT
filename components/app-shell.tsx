import { Archive, CalendarDays, ClipboardList, LogOut, Megaphone, Moon, Music2, Settings, Sun, Ticket, Users, type LucideIcon } from "lucide-react";
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
  dark,
  toggleTheme,
}: {
  data: AppData;
  currentUser: ClubUser;
  portal: Portal;
  persist: (data: AppData) => void;
  logout: () => void;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const adminMode = portal === "admin" && isAdminRole(currentUser.role);
  const [view, setView] = useState("calendar");
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-background p-4 md:block">
        <div className="mb-4 px-2 pb-4">
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
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="pb-28 md:ml-64 md:pb-6">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-background px-4 pb-2 pt-3 sm:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">
                {currentUser.name} ({roleLabel(currentUser.role)}){adminMode && " 관리자 화면"}
              </p>
              <h2 className="truncate text-2xl font-bold tracking-tight">{nav.find(([id]) => id === view)?.[1]}</h2>
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
          {view === "archive" && <ArchivePanel data={data} persist={persist} />}
          {view === "notices" && <NoticePanel data={data} currentUser={currentUser} persist={persist} admin />}
          {view === "surveys" && <SurveyPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "leader" && <LeaderPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "performances-user" && <PerformanceView data={data} />}
          {view === "notices-user" && <NoticePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "mypage" && <MyPagePanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
        </div>
      </section>

      {/* 휴대폰: 엄지로 바로 누르는 아래 메뉴. 이름은 상단 제목에 나온다. */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-between rounded-full bg-foreground p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden">
        {nav.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-current={view === id ? "page" : undefined}
            className={cn("grid h-11 w-11 place-items-center rounded-full transition", view === id ? "bg-[#FFF200] text-neutral-900" : "text-background")}
            onClick={() => { setView(id); window.scrollTo(0, 0); }}
          >
            <Icon size={20} />
          </button>
        ))}
      </nav>
    </main>
  );
}
