import { MEDIA_BIND_ACTIONS, MEDIA_BIND_DEFAULTS, MEDIA_BINDS_ENABLED_KEY, MEDIA_BIND_KEY } from "./index";

export type BindSlotValue = string;

export const MEDIA_BIND_KEY_2 = (actionId: string) => `binds/${actionId}#2`;

/** Кнопки мыши: 1=middle, 3=X1/назад, 4=X2/вперёд. 0/2 (ЛКМ/ПКМ) запрещены. */
export const MOUSE_BUTTONS: Record<number, string> = {
  1: "Mouse:Middle",
  3: "Mouse:X1",
  4: "Mouse:X2",
};

export const MOUSE_LABELS: Record<string, string> = {
  "Mouse:Middle": "🖱 Средняя",
  "Mouse:X1": "🖱 X1",
  "Mouse:X2": "🖱 X2",
};

export function isMouseBind(value: string | undefined): boolean {
  return typeof value === "string" && value.startsWith("Mouse:");
}

export function formatBind(value: string | undefined): string {
  if (!value) return "—";
  if (MOUSE_LABELS[value]) return MOUSE_LABELS[value]!;
  return value;
}

async function loadMouseMap(): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  try {
    for (const a of MEDIA_BIND_ACTIONS) {
      const slots = [
        await window.yandexMusicMod.getStorageValue(MEDIA_BIND_KEY(a.id)),
        await window.yandexMusicMod.getStorageValue(MEDIA_BIND_KEY_2(a.id)),
      ];
      for (const v of slots) {
        if (!isMouseBind(v)) continue;
        const btn = v === "Mouse:Middle" ? 1 : v === "Mouse:X1" ? 3 : v === "Mouse:X2" ? 4 : -1;
        if (btn < 0) continue;
        if (!map.has(btn)) map.set(btn, []);
        map.get(btn)!.push(a.id);
      }
    }
  } catch {}
  return map;
}

let mouseMap: Map<number, string[]> = new Map();
let mouseListenerAttached = false;

async function refreshMouseMap() {
  mouseMap = await loadMouseMap();
}

function onMouseDown(e: MouseEvent) {
  // ЛКМ (0) и ПКМ (2) никогда не перехватываем
  if (e.button !== 1 && e.button !== 3 && e.button !== 4) return;
  const actions = mouseMap.get(e.button);
  if (!actions || actions.length === 0) return;
  e.preventDefault();
  e.stopPropagation();
  for (const actionId of actions) {
    try {
      (window as any).__cozyMediaAction?.(actionId);
    } catch {}
  }
}

export function initMouseBinds() {
  refreshMouseMap();
  if (!mouseListenerAttached) {
    mouseListenerAttached = true;
    // capture: true чтобы срабатывать раньше сайтовых обработчиков (назад/вперёд)
    window.addEventListener("mousedown", onMouseDown, true);
  }
  try {
    window.yandexMusicMod.onStorageChanged((key: string) => {
      if (key.startsWith("binds/")) refreshMouseMap();
    });
  } catch {}
}
