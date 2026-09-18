import availableFonts from "@ui/assets/fonts/fonts.json";

const stylesheetName = "yandex-music-mod-font-changer-style";
const userFontFaceId = "yandex-music-mod-user-font-face";

const userFontCache = new Map<string, string>();

const FONT_FORMAT: Record<string, string> = {
  "font/ttf": "truetype",
  "font/otf": "opentype",
  "font/woff": "woff",
  "font/woff2": "woff2",
};

async function getUserFontFace(file: string, family: string): Promise<string | null> {
  const cacheKey = `${family}::${file}`;
  if (userFontCache.has(cacheKey)) return userFontCache.get(cacheKey)!;
  try {
    const res = await window.yandexMusicMod.readUserFont(file);
    if (!res?.success || !res.dataBase64) return null;
    const format = FONT_FORMAT[res.mime || ""] || "truetype";
    const css = `@font-face {
  font-family: "${family}";
  src: url(data:${res.mime};base64,${res.dataBase64}) format("${format}");
  font-display: swap;
}`;
    userFontCache.set(cacheKey, css);
    if (userFontCache.size > 10) userFontCache.delete(userFontCache.keys().next().value!);
    return css;
  } catch (e) {
    console.error("[font-changer] user font read failed:", e);
    return null;
  }
}

async function updateFont() {
  const savedFontValue = await window.yandexMusicMod.getStorageValue("font-changer/savedFont");
  const fontChangerEnabled = await window.yandexMusicMod.getStorageValue("font-changer/enabled");

  document.getElementById(stylesheetName)?.remove();
  document.getElementById(userFontFaceId)?.remove();

  if (!fontChangerEnabled) return;

  // 1. Встроенные шрифты
  const savedFont = availableFonts.find((font) => font.name === savedFontValue) || availableFonts[0];
  if (savedFontValue === undefined || savedFont?.name === savedFontValue) {
    if (!savedFont) {
      console.error("[font-changer]", "No font found");
      return;
    }
    console.log("[font-changer]", { savedFont, fontChangerEnabled });
    const styleSheet = document.createElement("style");
    styleSheet.id = stylesheetName;
    styleSheet.innerHTML = `* {
  font-family: "${savedFont.family}" !important;
}
${savedFont?.extraStylesheet || ""}
`;
    document.head.appendChild(styleSheet);
    return;
  }

  // 2. Пользовательские шрифты (по имени файла из списка)
  try {
    const listRes = await window.yandexMusicMod.listUserFonts();
    const entry = listRes?.success ? (listRes.fonts || []).find((f) => f.name === savedFontValue) : undefined;
    if (!entry) {
      console.error("[font-changer]", "User font not found:", savedFontValue);
      return;
    }
    const face = await getUserFontFace(entry.file, entry.name);
    if (!face) return;
    console.log("[font-changer] user font:", entry);
    const faceEl = document.createElement("style");
    faceEl.id = userFontFaceId;
    faceEl.textContent = face;
    document.head.appendChild(faceEl);
    const styleSheet = document.createElement("style");
    styleSheet.id = stylesheetName;
    styleSheet.innerHTML = `* {
  font-family: "${entry.name}" !important;
}`;
    document.head.appendChild(styleSheet);
  } catch (e) {
    console.error("[font-changer] failed:", e);
  }
}

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key.includes("font-changer")) {
    userFontCache.clear();
    updateFont();
  }
});

updateFont();
