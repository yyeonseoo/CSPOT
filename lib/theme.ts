// 배경 무늬 테마. public/patterns 의 호피 사진을 반복해서 깐다. 글자가 있는 카드와 상단 바는 단색이라 그대로 읽힌다.
export const PATTERN_KEY = "club-scheduler-pattern";

export const LEOPARDS = [
  { id: "leopard-1", label: "블루" },
  { id: "leopard-2", label: "레드" },
  { id: "leopard-3", label: "라임" },
  { id: "leopard-4", label: "퍼플" },
  { id: "leopard-5", label: "라일락" },
  { id: "leopard-6", label: "모브" },
  { id: "leopard-7", label: "로즈" },
  { id: "leopard-8", label: "핑크" },
  { id: "leopard-9", label: "블랙핑크" },
  { id: "leopard-10", label: "스카이" },
  { id: "leopard-11", label: "피치" },
  { id: "leopard-12", label: "클래식" },
];

export function patternBackground(id: string) {
  return LEOPARDS.some((item) => item.id === id) ? `url("/patterns/${id}.jpg") 0 0 / 220px repeat` : "";
}

// 고른 무늬를 이 기기에 저장하고 바로 적용한다. 빈 값이면 기본(흰 바탕).
export function applyPattern(id: string) {
  try {
    if (id) window.localStorage.setItem(PATTERN_KEY, id);
    else window.localStorage.removeItem(PATTERN_KEY);
  } catch {
    // 저장이 막힌 브라우저에서도 지금 화면에는 적용
  }
  const background = patternBackground(id);
  if (background) document.documentElement.style.setProperty("--app-pattern", background);
  else document.documentElement.style.removeProperty("--app-pattern");
}

export function readPattern() {
  try {
    const id = window.localStorage.getItem(PATTERN_KEY) ?? "";
    // 예전 버전의 무늬 이름이면 기본으로
    return LEOPARDS.some((item) => item.id === id) ? id : "";
  } catch {
    return "";
  }
}
