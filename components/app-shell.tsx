import { Archive, CalendarDays, ClipboardList, LogOut, Megaphone, Moon, Music2, Settings, Sparkles, Sun, Users, type LucideIcon } from "lucide-react";
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
import { SurveyPanel } from "@/components/survey-panel";
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
  onReset,
}: {
  data: AppData;
  currentUser: ClubUser;
  portal: Portal;
  persist: (data: AppData) => void;
  logout: () => void;
  dark: boolean;
  toggleTheme: () => void;
  onReset: () => void;
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
        ["audit", "로그", ClipboardList],
        ["mypage", "마이", Settings],
      ]
    : [
        ["calendar", "캘린더", CalendarDays],
        ["surveys", "조사", ClipboardList],
        ["notices-user", "공지", Megaphone],
        ["mypage", "마이", Settings],
      ];

  return (
    <main className="soft-shell min-h-screen">
      <aside className="fixed inset-x-3 bottom-3 z-20 rounded-[1.4rem] border border-white/70 bg-white/84 p-2 shadow-[0_16px_40px_rgba(86,144,183,0.14)] backdrop-blur md:inset-y-4 md:left-4 md:right-auto md:w-80 md:p-5 dark:border-white/10 dark:bg-card/82">
        <div className="hidden pb-5 md:block">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles size={21} />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">Club Scheduler</p>
              <h1 className="text-lg font-black">{adminMode ? "관리자 공간" : "사용자 공간"}</h1>
            </div>
          </div>
        </div>
        <nav className="grid grid-cols-4 gap-1 md:block md:space-y-2">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 text-xs font-bold transition md:flex-row md:justify-start md:px-4 md:py-3 md:text-sm",
                view === id ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-muted/70",
              )}
              onClick={() => setView(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="pb-28 md:ml-[22rem] md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">
              {roleLabel(currentUser.role)} · {currentUser.name} · {adminMode ? "관리자" : "사용자"}
            </p>
            <h2 className="text-2xl font-black">{view === "calendar" ? "이번 달 일정" : nav.find(([id]) => id === view)?.[1]}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-card/70" onClick={toggleTheme} aria-label="테마 변경">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="rounded-2xl border border-white/70 bg-white/75 p-3 shadow-sm dark:border-white/10 dark:bg-card/70" onClick={logout} aria-label="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="p-5 pt-1 sm:p-8 sm:pt-2">
          {view === "calendar" && <CalendarPanel data={data} currentUser={currentUser} adminMode={adminMode} persist={persist} />}
          {view === "users" && <UsersPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "performances" && <PerformanceManager data={data} currentUser={currentUser} persist={persist} />}
          {view === "songs" && <SongManagementPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "archive" && <ArchivePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "notices" && <NoticePanel data={data} currentUser={currentUser} persist={persist} admin />}
          {view === "audit" && <AuditPanel data={data} onReset={onReset} />}
          {view === "surveys" && <SurveyPanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "notices-user" && <NoticePanel data={data} currentUser={currentUser} persist={persist} />}
          {view === "mypage" && <MyPagePanel data={data} currentUser={currentUser} persist={persist} />}
        </div>
      </section>
    </main>
  );
}
