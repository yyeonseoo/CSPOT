// 화면 색 조합. 바탕(page)은 색을 깔고 카드는 흰색으로 두어 카드 경계가 보이게 한다. 이 기기에만 저장.
export const THEME_KEY = "club-scheduler-theme";

type Theme = { id: string; label: string; dark?: boolean; page?: string; pageText?: string; accent?: string; accentText?: string };

const white = "0 0% 100%";
const black = "0 0% 7%";

export const THEMES: Theme[] = [
  { id: "black", label: "블랙", dark: true },
  { id: "white", label: "화이트", page: "0 0% 92%", pageText: black },
  { id: "purple-green", label: "보라 & 초록", page: "255 100% 62%", pageText: white, accent: "78 100% 62%", accentText: black },
  { id: "purple-yellow", label: "보라 & 노랑", page: "255 100% 62%", pageText: white, accent: "57 100% 50%", accentText: black },
  { id: "gray-pink", label: "회색 & 핑크", page: "240 3% 20%", pageText: white, accent: "313 100% 65%", accentText: black },
  { id: "red-yellow", label: "다홍 & 노랑", page: "9 100% 59%", pageText: white, accent: "57 100% 50%", accentText: black },
  { id: "blue-yellow", label: "파랑 & 노랑", page: "228 100% 56%", pageText: white, accent: "57 100% 50%", accentText: black },
  { id: "lime-black", label: "라임 & 블랙", page: "78 100% 62%", pageText: black },
];

export function readTheme() {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    // 예전 흰 화면 설정은 화이트로
    const id = saved === "light" ? "white" : saved;
    return THEMES.some((theme) => theme.id === id) ? id! : "black";
  } catch {
    return "black";
  }
}

export function applyTheme(id: string) {
  const theme = THEMES.find((item) => item.id === id) ?? THEMES[0];
  try {
    window.localStorage.setItem(THEME_KEY, theme.id);
  } catch {
    // 저장이 막힌 브라우저에서도 지금 화면에는 적용
  }
  const root = document.documentElement;
  root.classList.toggle("dark", !!theme.dark);
  const vars: Record<string, string | undefined> = { "--page": theme.page, "--page-foreground": theme.pageText, "--primary": theme.accent, "--primary-foreground": theme.accentText };
  for (const [name, value] of Object.entries(vars)) {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}
