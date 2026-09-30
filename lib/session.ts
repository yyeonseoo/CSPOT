import { SESSION_KEY } from "@/lib/local-data";

export type Portal = "user" | "admin";

export type Session = { userId: string; portal: Portal };

export function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return { userId: raw, portal: "user" };
  }
}

export function writeSession(session: Session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
