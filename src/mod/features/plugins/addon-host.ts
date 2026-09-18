import { currentTrackEntity } from "./pulsesync-shim";
import { getPluginSettingsObject } from "./pulsesync-shim";

/**
 * Хост нового API аддонов (WolfyLibrary-стиль): window.Addon + флаг
 * window.__WOLFYLIBRARY_LOADED__. Нужен плагинам вроде BetterPlayer:
 *   const t = new window.Addon(name);
 *   t.addAction(id, ({ setting, settings, state }) => ...);
 *   t.player.on("openPlayer" | "trackChange", (ctx) => ...);
 *   t.start();
 */

type ActionCtx = {
  setting: { value: any };
  settings: { get: (id: string) => { value: any } };
  state: { track: any | null };
  player?: any;
};

type PlayerHandler = (ctx: ActionCtx) => void;

const addons: Record<string, CozyAddon> = {};

function settingsReader(addonName: string) {
  return {
    get: (id: string) => {
      try {
        const cur = getPluginSettingsObject(addonName).getCurrent();
        return cur[id] ?? { value: undefined };
      } catch {
        return { value: undefined };
      }
    },
  };
}

function stateReader() {
  return { track: currentTrackEntity() };
}

class CozyAddon {
  name: string;
  private actions = new Map<string, (ctx: ActionCtx) => void>();
  private playerHandlers = new Map<string, Set<PlayerHandler>>();
  private started = false;
  private lastTrackId: string | number | null = null;
  private timers: ReturnType<typeof setInterval>[] = [];
  private modalObs: MutationObserver | null = null;

  constructor(name: string) {
    this.name = name;
    addons[name] = this;
  }

  addAction(id: string, cb: (ctx: ActionCtx) => void) {
    this.actions.set(id, cb);
  }

  player = {
    on: (event: string, cb: PlayerHandler) => {
      if (!this.playerHandlers.has(event)) this.playerHandlers.set(event, new Set());
      this.playerHandlers.get(event)!.add(cb);
    },
  };

  private emitPlayer(event: string) {
    const ctx: ActionCtx = {
      setting: { value: undefined },
      settings: settingsReader(this.name),
      state: stateReader(),
      player: this.player,
    };
    this.playerHandlers.get(event)?.forEach((cb) => {
      try {
        cb(ctx);
      } catch (e) {
        console.error(`[plugins:AddOn] player handler failed (${this.name}/${event}):`, e);
      }
    });
  }

  private runAction(id: string, value: any) {
    const cb = this.actions.get(id);
    if (!cb) return;
    try {
      cb({ setting: { value }, settings: settingsReader(this.name), state: stateReader(), player: this.player });
    } catch (e) {
      console.error(`[plugins:AddOn] action failed (${this.name}/${id}):`, e);
    }
  }

  private runAllActions() {
    try {
      const cur = getPluginSettingsObject(this.name).getCurrent();
      for (const [id, entry] of Object.entries(cur)) {
        this.runAction(id, (entry as any)?.value);
      }
    } catch {}
  }

  start() {
    if (this.started) return;
    this.started = true;

    // прогнать все экшены с текущими значениями + подписаться на изменения
    // (запускаем только изменившиеся, чтобы не уйти в цикл)
    let lastValues: Record<string, any> = {};
    const snapshot = () => {
      const out: Record<string, any> = {};
      try {
        const cur = getPluginSettingsObject(this.name).getCurrent();
        for (const [k, v] of Object.entries(cur)) out[k] = (v as any)?.value;
      } catch {}
      return out;
    };
    const dispatchChanges = () => {
      const cur = snapshot();
      for (const [k, v] of Object.entries(cur)) {
        if (lastValues[k] !== v) this.runAction(k, v);
      }
      lastValues = cur;
    };
    try {
      getPluginSettingsObject(this.name).onChange(() => dispatchChanges());
    } catch {}
    setTimeout(() => {
      lastValues = snapshot();
      this.runAllActions();
    }, 500);

    // трекинг смены трека
    this.timers.push(
      setInterval(() => {
        try {
          const track = currentTrackEntity();
          const id = track?.id ?? null;
          if (id !== this.lastTrackId) {
            this.lastTrackId = id;
            if (id !== null) this.emitPlayer("trackChange");
          }
        } catch {}
      }, 2000),
    );

    // открытие полноэкранного плеера
    const MODAL_SELECTOR = '[data-test-id="FULLSCREEN_PLAYER_MODAL"]';
    try {
      const check = () => {
        try {
          if (document.querySelector(MODAL_SELECTOR)) this.emitPlayer("openPlayer");
        } catch {}
      };
      this.modalObs = new MutationObserver(check);
      this.modalObs.observe(document.body, { childList: true, subtree: true });
      check();
    } catch {}
  }
}

export function installAddonHost() {
  if ((window as any).Addon) return;
  (window as any).Addon = CozyAddon;
  (window as any).__WOLFYLIBRARY_LOADED__ = true;
  console.log("[plugins] Addon host installed (__WOLFYLIBRARY_LOADED__)");
}

/** Пробросить изменение настройки в экшены Addon-плагина. */
export function notifyAddonSetting(addonName: string, settingId: string, value: any) {
  const addon = addons[addonName];
  if (!addon) return;
  try {
    (addon as any).runAction(settingId, value);
  } catch {}
}
