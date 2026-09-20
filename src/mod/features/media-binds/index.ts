import "./media-binds";

// Глобальные горячие клавиши: исполнение на стороне страницы,
// регистрация — в main-процессе (globalShortcut).
export const MEDIA_BIND_ACTIONS = [
  { id: "playPause", label: "Включить музыку" },
  { id: "stop", label: "Стоп музыку" },
  { id: "prev", label: "Назад песню" },
  { id: "next", label: "Вперёд песню" },
  { id: "volUp", label: "Прибавить громкость" },
  { id: "volDown", label: "Убавить громкость" },
] as const;

export const MEDIA_BIND_DEFAULTS: Record<string, string> = {
  playPause: "MediaPlayPause",
  stop: "MediaStop",
  prev: "MediaPreviousTrack",
  next: "MediaNextTrack",
  volUp: "Control+Alt+Up",
  volDown: "Control+Alt+Down",
};

export const MEDIA_BINDS_ENABLED_KEY = "binds/enabled";
export const MEDIA_BIND_KEY = (actionId: string) => `binds/${actionId}`;
