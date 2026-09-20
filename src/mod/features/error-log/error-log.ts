// Глобальный перехват ошибок рендера: дублирует их в файл
// userData/cozy-renderer.log через main-процесс, чтобы диагностировать
// падения без открытых DevTools.

function sendToFile(kind: string, text: string) {
  try {
    (window as any).yandexMusicMod?.logRenderer?.(`[${kind}] ${text}`).catch(() => {});
  } catch {}
}

window.addEventListener(
  "error",
  (event) => {
    try {
      const msg = event?.message || "unknown error";
      const src = event?.filename ? ` @ ${event.filename}:${event?.lineno}` : "";
      sendToFile("window.onerror", `${msg}${src}`);
    } catch {}
  },
  true,
);

window.addEventListener("unhandledrejection", (event) => {
  try {
    const reason: any = (event as any)?.reason;
    const msg = reason?.stack || reason?.message || String(reason);
    sendToFile("unhandledrejection", String(msg).slice(0, 2000));
  } catch {}
});
