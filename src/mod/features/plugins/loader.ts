import {
  installPulsesyncShim,
  hydratePluginSettings,
  getPluginSettingsObject,
  type PluginSettingsMap,
} from "./pulsesync-shim";
import { PLUGIN_REGISTRY, type PluginMeta } from "./registry";
import { resolvePluginMeta } from "./custom";

export const PLUGINS_ENABLED_KEY = "plugins/enabled";

const loaded = new Map<string, () => void>();

async function fetchText(url: string, timeoutMs = 15000, token?: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, { signal: ctrl.signal, headers });
    if (!res.ok) throw new Error(`http_${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function injectStyle(pluginId: string, css: string) {
  removeStyle(pluginId);
  const el = document.createElement("style");
  el.id = `cozy-plugin-style-${pluginId}`;
  el.textContent = css;
  document.head.appendChild(el);
}

function removeStyle(pluginId: string) {
  document.getElementById(`cozy-plugin-style-${pluginId}`)?.remove();
}

export interface PluginHandles {
  sections: { title: string; items: PluginHandleItem[] }[];
}

export interface PluginHandleItem {
  id: string;
  name: string;
  description?: string;
  type: string;
  bool?: boolean;
  min?: number;
  max?: number;
  step?: number;
  value?: any;
  defaultParameter?: any;
  options?: { value: string; label?: string }[] | string[];
}

export async function fetchPluginMeta(meta: PluginMeta): Promise<Partial<PluginMeta>> {
  try {
    if (!meta.metaUrl) return {};
    const raw = await fetchText(meta.metaUrl, 15000, meta.token);
    const json = JSON.parse(raw);
    return {
      name: json.name || meta.name,
      author: Array.isArray(json.author) ? json.author.join(", ") : json.author || meta.author,
      description: json.description || meta.description,
    };
  } catch {
    return {};
  }
}

export async function fetchPluginHandles(meta: PluginMeta): Promise<PluginHandles | null> {
  try {
    if (!meta.handlesUrl) return null;
    return JSON.parse(await fetchText(meta.handlesUrl, 15000, meta.token)) as PluginHandles;
  } catch {
    return null;
  }
}

export function defaultsFromHandles(handles: PluginHandles | null): PluginSettingsMap {
  const out: PluginSettingsMap = {};
  if (!handles) return out;
  for (const section of handles.sections || []) {
    for (const item of section.items || []) {
      if (!item || !item.id) continue;
      const v =
        item.defaultParameter !== undefined
          ? item.defaultParameter
          : (item as any).defaultValue !== undefined
            ? (item as any).defaultValue
            : item.value;
      out[item.id] = { value: v !== undefined ? v : item.bool === true ? true : false };
    }
  }
  return out;
}

export async function enablePlugin(meta: PluginMeta): Promise<void> {
  if (loaded.has(meta.id)) return;
  const [code, css] = await Promise.all([
    fetchText(meta.scriptUrl, 15000, meta.token),
    meta.styleUrl ? fetchText(meta.styleUrl, 15000, meta.token).catch(() => null) : Promise.resolve(null),
  ]);
  if (css) injectStyle(meta.id, css);
  const el = document.createElement("script");
  el.id = `cozy-plugin-script-${meta.id}`;
  el.textContent = code;
  // scripts ожидают обычный exécution-контекст страницы (IIFE с document/window)
  (document.head || document.documentElement).appendChild(el);
  loaded.set(meta.id, () => {
    try {
      (window as any)[`__cozyPluginDispose_${meta.id}`]?.();
    } catch {}
    el.remove();
    removeStyle(meta.id);
  });
  console.log(`[plugins] enabled: ${meta.name}`);
}

export function disablePlugin(pluginId: string) {
  try {
    loaded.get(pluginId)?.();
  } catch {}
  loaded.delete(pluginId);
  console.log(`[plugins] disabled: ${pluginId}`);
}

export function isPluginLoaded(pluginId: string): boolean {
  return loaded.has(pluginId);
}

export async function getEnabledPluginIds(): Promise<string[]> {
  try {
    const v = await window.yandexMusicMod.getStorageValue(PLUGINS_ENABLED_KEY);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function setEnabledPluginIds(ids: string[]) {
  try {
    await window.yandexMusicMod.setStorageValue(PLUGINS_ENABLED_KEY, ids);
  } catch {}
}

export async function initPluginsEngine() {
  installPulsesyncShim();
  // гидрация дефолтов настроек + автовключение сохранённых
  const enabled = await getEnabledPluginIds();
  for (const meta of PLUGIN_REGISTRY) {
    try {
      const handles = await fetchPluginHandles(meta).catch(() => null);
      await hydratePluginSettings(meta.settingsName, defaultsFromHandles(handles));
    } catch {}
  }
  for (const id of enabled) {
    const meta = await resolvePluginMeta(id, PLUGIN_REGISTRY);
    if (!meta) continue;
    try {
      await enablePlugin(meta);
    } catch (e) {
      console.error(`[plugins] autoload failed: ${meta.name}`, e);
    }
  }
  window.yandexMusicMod.onStorageChanged(() => {});
}

export { getPluginSettingsObject };
export type { PluginSettingsMap };
