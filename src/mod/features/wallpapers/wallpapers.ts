export interface WallpaperItem {
  id: string;
  name: string;
  dataUrl: string;
}

export const WALLPAPER_KEYS = {
  enabled: "wallpapers/enabled",
  list: "wallpapers/list",
  activeId: "wallpapers/activeId",
  fit: "wallpapers/fit", // "cover" | "contain"
  dim: "wallpapers/dim", // 0..0.85 затемнение для читаемости
  slideshow: "wallpapers/slideshow", // 0=выкл, иначе секунды
} as const;

const STYLE_ID = "ym-mod-wallpaper-style";
const LAYOUT_SELECTOR = 'div[class*="DefaultLayout_root__"]';

let lastSlideshowSwitch = Date.now();
let slideshowTimer: ReturnType<typeof setInterval> | null = null;

async function getAll(): Promise<{
  enabled: boolean;
  list: WallpaperItem[];
  activeId: string | null;
  fit: string;
  dim: number;
  slideshow: number;
}> {
  const get = (k: string) => window.yandexMusicMod.getStorageValue(k);
  const [enabled, list, activeId, fit, dim, slideshow] = await Promise.all([
    get(WALLPAPER_KEYS.enabled),
    get(WALLPAPER_KEYS.list),
    get(WALLPAPER_KEYS.activeId),
    get(WALLPAPER_KEYS.fit),
    get(WALLPAPER_KEYS.dim),
    get(WALLPAPER_KEYS.slideshow),
  ]);
  return {
    enabled: enabled === true,
    list: Array.isArray(list) ? list : [],
    activeId: typeof activeId === "string" ? activeId : null,
    fit: fit === "contain" ? "contain" : "cover",
    dim: typeof dim === "number" ? Math.min(0.85, Math.max(0, dim)) : 0.5,
    slideshow: typeof slideshow === "number" ? slideshow : 0,
  };
}

function escapeUrl(dataUrl: string): string {
  return dataUrl.replace(/"/g, "%22").replace(/\n/g, "");
}

export async function applyWallpapers() {
  const { enabled, list, activeId, fit, dim } = await getAll();

  document.getElementById(STYLE_ID)?.remove();

  const active = list.find((w) => w.id === activeId) ?? list[0];
  if (!enabled || !active) {
    console.log("[wallpapers] disabled or empty");
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  // Обои — фон корневого лэйаута Яндекс Музыки (а не меню мода).
  // Затемнение через inset box-shadow поверх картинки, но под контентом.
  style.innerHTML = `
${LAYOUT_SELECTOR} {
  background-image: url("${escapeUrl(active.dataUrl)}") !important;
  background-size: ${fit} !important;
  background-position: center center !important;
  background-attachment: fixed !important;
  background-repeat: no-repeat !important;
  box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, ${dim}) !important;
}`;
  document.head.appendChild(style);
  console.log("[wallpapers] applied:", active.name, { fit, dim });
}

async function maybeSlideshow() {
  try {
    const { enabled, list, slideshow, activeId } = await getAll();
    if (!enabled || !slideshow || list.length < 2) return;
    if (Date.now() - lastSlideshowSwitch < slideshow * 1000) return;
    const idx = Math.max(
      0,
      list.findIndex((w) => w.id === activeId),
    );
    const next = list[(idx + 1) % list.length]!;
    await window.yandexMusicMod.setStorageValue(WALLPAPER_KEYS.activeId, next.id);
    lastSlideshowSwitch = Date.now();
    await applyWallpapers();
    console.log("[wallpapers] slideshow ->", next.name);
  } catch (e) {
    console.error("[wallpapers] slideshow failed:", e);
  }
}

export function initWallpapersEngine() {
  applyWallpapers();
  if (!slideshowTimer) {
    slideshowTimer = setInterval(maybeSlideshow, 30 * 1000);
  }
  window.yandexMusicMod.onStorageChanged((key: string) => {
    if (key.startsWith("wallpapers/")) {
      lastSlideshowSwitch = Date.now();
      applyWallpapers();
    }
  });
}
