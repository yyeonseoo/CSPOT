// 배경 무늬 테마. 무늬는 이미지 파일 없이 SVG로 직접 그리고, 글자가 없는 바탕에만 깐다.
export const PATTERN_KEY = "club-scheduler-pattern";

type Leopard = { id: string; label: string; base: string; spot: string; ring: string };

export const LEOPARDS: Leopard[] = [
  { id: "leopard-blue", label: "블루", base: "#B7EBF2", spot: "#79CBE3", ring: "#1E5F74" },
  { id: "leopard-red", label: "레드", base: "#FFFFFF", spot: "#F7A2A2", ring: "#E1262F" },
  { id: "leopard-lime", label: "라임", base: "#E6F7CC", spot: "#BDE88A", ring: "#6CC417" },
  { id: "leopard-purple", label: "퍼플", base: "#F9DCFF", spot: "#DCBDF3", ring: "#9361CC" },
  { id: "leopard-lilac", label: "라일락", base: "#FBF2FF", spot: "#F0E1FB", ring: "#C9A6E6" },
  { id: "leopard-rose", label: "로즈", base: "#FFE6E6", spot: "#F3C3C3", ring: "#C98585" },
  { id: "leopard-pink", label: "핑크", base: "#F9BBD1", spot: "#F49DBE", ring: "#E1578C" },
  { id: "leopard-blackpink", label: "블랙핑크", base: "#F8ABC8", spot: "#F05C9C", ring: "#111111" },
  { id: "leopard-sky", label: "스카이", base: "#C4E7F7", spot: "#F7BEDC", ring: "#111111" },
  { id: "leopard-peach", label: "피치", base: "#FFD6B8", spot: "#F3A868", ring: "#7B4A1F" },
  { id: "leopard-classic", label: "클래식", base: "#D7BA90", spot: "#9C6A35", ring: "#1B140C" },
];

// 140px 타일을 4x4 칸으로 나누고 칸마다 반점 하나를 조금씩 흔들어 놓는다.
// 반점 = 울퉁불퉁한 안쪽 점 + 2~3개로 끊긴 바깥 고리. 난수는 고정 시드라 항상 같은 무늬가 나온다.
function leopardSvg({ base, spot, ring }: Leopard) {
  let seed = 11;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const point = (cx: number, cy: number, r: number, angle: number) => `${(cx + Math.cos(angle) * r).toFixed(1)} ${(cy + Math.sin(angle) * r).toFixed(1)}`;
  const shapes: string[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const cx = col * 35 + 17.5 + (rand() - 0.5) * 14 + (row % 2) * 8;
      const cy = row * 35 + 17.5 + (rand() - 0.5) * 14;
      const r = 6 + rand() * 4;
      // 울퉁불퉁한 점: 7개 꼭짓점을 반지름을 흔들어 이은 다각형을 둥글게
      const parts: string[] = [];
      // 울퉁불퉁한 점: 7개 꼭짓점을 반지름을 흔들어 이은 다각형을 둥글게
      const blob = Array.from({ length: 7 }, (_, index) => point(cx, cy, r * (0.75 + rand() * 0.4), (index / 7) * Math.PI * 2)).join(" L ");
      parts.push(`<path d="M ${blob} Z" fill="${spot}" stroke="${spot}" stroke-width="3" stroke-linejoin="round"/>`);
      // 끊긴 고리 2~3조각
      const pieces = 2 + Math.floor(rand() * 2);
      const start = rand() * Math.PI * 2;
      for (let piece = 0; piece < pieces; piece += 1) {
        const from = start + (piece / pieces) * Math.PI * 2;
        const to = from + (Math.PI * 2) / pieces - 0.6 - rand() * 0.4;
        const ringR = r + 3.5;
        parts.push(`<path d="M ${point(cx, cy, ringR, from)} A ${ringR} ${ringR * 0.9} 0 0 1 ${point(cx, cy, ringR, to)}" stroke="${ring}" stroke-width="${(3.5 + rand() * 1.5).toFixed(1)}" fill="none" stroke-linecap="round"/>`);
      }
      // 타일 가장자리에 걸친 반점은 반대편에도 그려서 이음매가 안 보이게
      const reach = r + 7;
      const xs = [0, ...(cx < reach ? [140] : []), ...(cx > 140 - reach ? [-140] : [])];
      const ys = [0, ...(cy < reach ? [140] : []), ...(cy > 140 - reach ? [-140] : [])];
      for (const dx of xs) for (const dy of ys) shapes.push(dx || dy ? `<g transform="translate(${dx} ${dy})">${parts.join("")}</g>` : parts.join(""));
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><rect width="140" height="140" fill="${base}"/>${shapes.join("")}</svg>`;
}

export function patternBackground(id: string) {
  const leopard = LEOPARDS.find((item) => item.id === id);
  if (!leopard) return "";
  return `url("data:image/svg+xml,${encodeURIComponent(leopardSvg(leopard))}") 0 0 / 140px repeat`;
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
    return window.localStorage.getItem(PATTERN_KEY) ?? "";
  } catch {
    return "";
  }
}
