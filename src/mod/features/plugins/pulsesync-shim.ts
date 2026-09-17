import { getTrackMeta, isPlaying } from "~/mod/features/utils/player";

/**
 * Шим host-API pulsesyncApi, который ждут сторонние плагины
 * (ReachVideoCover, CustomBackground, FckCensor и др.).
 */

export interface PluginSettingsMap {
  [settingId: string]: { value: any };
}

type SettingsListener = (s: PluginSettingsMap) => void;

const settingsStore: Record<string, PluginSettingsMap> = {};
const settingsListeners: Record<string, Set<SettingsListener>> = {};

export const PLUGIN_SETTINGS_KEY = (name: string) => `plugins/settings/${name}`;

function emitSettings(name: string) {
  const s = settingsStore[name] || {};
  settingsListeners[name]?.forEach((cb) => {
    try {
      cb(s);
    } catch {}
  });
}

export async function hydratePluginSettings(name: string, defaults: PluginSettingsMap) {
  if (!settingsStore[name]) settingsStore[name] = { ...defaults };
  else {
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in settingsStore[name])) settingsStore[name][k] = v;
    }
  }
  try {
    const saved = await window.yandexMusicMod.getStorageValue(PLUGIN_SETTINGS_KEY(name));
    if (saved && typeof saved === "object") {
      for (const [k, v] of Object.entries(saved as Record<string, any>)) {
        settingsStore[name][k] = { value: v && typeof v === "object" && "value" in v ? (v as any).value : v };
      }
    }
  } catch {}
  emitSettings(name);
}

export function setPluginSetting(name: string, settingId: string, value: any) {
  if (!settingsStore[name]) settingsStore[name] = {};
  settingsStore[name][settingId] = { value };
  const raw: Record<string, any> = {};
  for (const [k, v] of Object.entries(settingsStore[name])) raw[k] = v.value;
  try {
    window.yandexMusicMod.setStorageValue(PLUGIN_SETTINGS_KEY(name), raw);
  } catch {}
  emitSettings(name);
}

export function getPluginSettingsObject(name: string) {
  if (!settingsStore[name]) settingsStore[name] = {};
  return {
    getCurrent: () => settingsStore[name],
    onChange: (cb: SettingsListener) => {
      if (!settingsListeners[name]) settingsListeners[name] = new Set();
      settingsListeners[name].add(cb);
      try {
        cb(settingsStore[name]);
      } catch {}
      return () => {
        settingsListeners[name]?.delete(cb);
      };
    },
  };
}

// --- мини-шина событий плеера для плагинов (audio-paused/audio-resumed) ---
type PlayerEvCb = (event: string) => void;
const playerListeners = new Set<PlayerEvCb>();
let lastPlaying: boolean | null = null;

setInterval(() => {
  try {
    const r = isPlaying();
    const playing = r.isOk() ? r.value : false;
    if (lastPlaying === null) {
      lastPlaying = playing;
      return;
    }
    if (playing !== lastPlaying) {
      lastPlaying = playing;
      playerListeners.forEach((cb) => {
        try {
          cb(playing ? "audio-resumed" : "audio-paused");
        } catch {}
      });
    }
  } catch {}
}, 1000);

function makeEventHub() {
  return {
    on(cb: PlayerEvCb) {
      playerListeners.add(cb);
      return () => {
        playerListeners.delete(cb);
      };
    },
    emit(ev: string) {
      playerListeners.forEach((cb) => {
        try {
          cb(ev);
        } catch {}
      });
    },
  };
}

export function currentTrackEntity(): any | null {
  try {
    const meta = getTrackMeta();
    if (meta.isErr()) return null;
    const m: any = meta.value;
    return {
      id: m.id,
      title: m.title,
      version: m.version,
      artists: m.artists,
      albums: m.albums,
      durationMs: m.durationMs,
      coverUri: m.coverUri,
      ogImage: m.ogImage,
    };
  } catch {
    return null;
  }
}

function readPlaying(): boolean {
  try {
    const r = isPlaying();
    return r.isOk() ? r.value : false;
  } catch {
    return false;
  }
}

export function installPulsesyncShim() {
  if ((window as any).pulsesyncApi) return;
  const api: any = {
    _addonSettings: settingsStore,
    getSettings: (name: string) => getPluginSettingsObject(name),
    getState: () => ({
      playerState: {
        isPlaying: readPlaying(),
        track: currentTrackEntity(),
        event: makeEventHub(),
      },
    }),
    getCurrentTrack: () => currentTrackEntity(),
    isPlaying: () => readPlaying(),
    playerInstance: null,
    playVibe: undefined,
    _waitForPlayer: (cb: (player: any) => void) => {
      const SELECTOR = 'section[data-test-id="PLAYERBAR_DESKTOP"]';
      const fire = () => {
        try {
          cb({});
        } catch {}
      };
      try {
        if (document.querySelector(SELECTOR)) {
          fire();
          return;
        }
      } catch {}
      try {
        const obs = new MutationObserver(() => {
          try {
            if (document.querySelector(SELECTOR)) {
              obs.disconnect();
              fire();
            }
          } catch {}
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
          try {
            obs.disconnect();
          } catch {}
          fire();
        }, 15000);
      } catch {
        fire();
      }
    },
  };
  (window as any).pulsesyncApi = api;
  console.log("[plugins] pulsesyncApi shim installed");
}
