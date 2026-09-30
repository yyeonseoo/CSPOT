"use client";

import { useEffect, useState } from "react";
import { nowIso } from "@/lib/format";
import { SESSION_KEY, readData, resetData, syncCurrentSongsToArchive, writeData } from "@/lib/local-data";
import { isAdminRole } from "@/lib/permissions";
import { readSession, writeSession, type Portal, type Session } from "@/lib/session";
import type { AppData } from "@/types/domain";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { PasswordChangeScreen } from "@/components/password-change-screen";

export default function HomePage() {
  const [data, setData] = useState<AppData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loginMode, setLoginMode] = useState<Portal>("user");
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setData(readData());
    setSession(readSession());
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function persist(next: AppData) {
    const synced = syncCurrentSongsToArchive(next);
    setData(synced);
    writeData(synced);
  }

  const currentUser = data?.users.find((user) => user.id === session?.userId) ?? null;

  function login(username: string, password: string) {
    if (!data) return "데이터를 불러오는 중입니다.";
    const user = data.users.find((item) => item.username === username && item.password === password && item.status === "ACTIVE");
    if (!user) return "아이디 또는 비밀번호를 확인해주세요.";
    if (loginMode === "admin" && !isAdminRole(user.role)) return "관리자 권한이 없는 계정입니다.";
    const nextSession = { userId: user.id, portal: loginMode };
    writeSession(nextSession);
    setSession(nextSession);
    return null;
  }

  function logout() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  }

  if (!data) return <main className="soft-shell grid min-h-screen place-items-center p-6">로컬 데이터를 준비하고 있어요.</main>;

  if (!currentUser) {
    return <LoginScreen mode={loginMode} setMode={setLoginMode} onLogin={login} onReset={() => persist(resetData())} dark={dark} toggleTheme={toggleTheme} />;
  }

  if (currentUser.mustChangePassword) {
    return (
      <PasswordChangeScreen
        user={currentUser}
        onChange={(password) => {
          persist({ ...data, users: data.users.map((user) => (user.id === currentUser.id ? { ...user, password, mustChangePassword: false, updatedAt: nowIso() } : user)) });
        }}
      />
    );
  }

  return (
    <AppShell
      data={data}
      currentUser={currentUser}
      portal={session?.portal ?? "user"}
      persist={persist}
      logout={logout}
      dark={dark}
      toggleTheme={toggleTheme}
      onReset={() => persist(resetData())}
    />
  );
}
