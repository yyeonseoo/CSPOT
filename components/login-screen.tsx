import { KeyRound, Moon, RotateCcw, Sparkles, Sun } from "lucide-react";
import { useState } from "react";
import type { Portal } from "@/lib/session";
import { Field, segmentClass } from "@/components/ui";

export function LoginScreen({
  mode,
  setMode,
  onLogin,
  onReset,
  dark,
  toggleTheme,
}: {
  mode: Portal;
  setMode: (mode: Portal) => void;
  onLogin: (username: string, password: string) => string | null;
  onReset: () => void;
  dark: boolean;
  toggleTheme: () => void;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [error, setError] = useState<string | null>(null);

  function switchMode(next: Portal) {
    setMode(next);
    setUsername("admin");
    setPassword("admin1234");
    setError(null);
  }

  return (
    <main className="soft-shell min-h-screen p-6 sm:p-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-[1500px] gap-14 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <button className="rounded-full border border-white/70 bg-white/75 p-3 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:bg-card/70" onClick={toggleTheme} aria-label="테마 변경">
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-primary shadow-sm backdrop-blur dark:bg-card/70">
              <Sparkles size={16} />
              Club schedule manager
            </span>
          </div>
          <h1 className="login-title-pop text-6xl font-black leading-tight sm:text-8xl">
            동아리 일정,
            <br />
            가볍게 정리.
          </h1>
        </section>

        <form
          className="login-card-rise rounded-[2rem] border border-white/70 bg-white/82 p-7 shadow-[0_24px_80px_rgba(86,144,183,0.14)] backdrop-blur dark:border-white/10 dark:bg-card/78"
          onSubmit={(event) => {
            event.preventDefault();
            setError(onLogin(username, password));
          }}
        >
          <div className="mb-5 rounded-[1.4rem] bg-muted/70 p-1.5">
            <div className="grid grid-cols-2 gap-1">
              <button type="button" className={segmentClass(mode === "user")} onClick={() => switchMode("user")}>사용자 로그인</button>
              <button type="button" className={segmentClass(mode === "admin")} onClick={() => switchMode("admin")}>관리자 로그인</button>
            </div>
          </div>
          <div className="space-y-5">
            <Field label="아이디" value={username} onChange={setUsername} />
            <Field label="비밀번호" type="password" value={password} onChange={setPassword} />
            {error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-lg font-bold text-primary-foreground shadow-lg shadow-primary/20">
              <KeyRound size={18} />
              로그인
            </button>
          </div>
          <div className="mt-5 rounded-2xl bg-muted/70 p-4 text-sm text-muted-foreground">초기 관리자 계정: admin/admin1234</div>
          <button type="button" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground" onClick={onReset}>
            <RotateCcw size={15} />
            로컬 데이터 초기화
          </button>
        </form>
      </div>
    </main>
  );
}
