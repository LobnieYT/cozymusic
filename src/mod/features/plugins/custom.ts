import type { PluginMeta } from "./registry";

export const CUSTOM_PLUGIN_ID = "custom-user-plugin";
const CUSTOM_KEY = "plugins/custom";

export interface CustomPlugin {
  name: string;
  url: string;
}

export async function getCustomPlugin(): Promise<CustomPlugin | null> {
  try {
    const v = await window.yandexMusicMod.getStorageValue(CUSTOM_KEY);
    if (v && typeof v.url === "string" && v.url.length > 0) {
      return { name: String(v.name || "Свой плагин"), url: v.url };
    }
  } catch {}
  return null;
}

export async function setCustomPlugin(p: CustomPlugin | null) {
  try {
    await window.yandexMusicMod.setStorageValue(CUSTOM_KEY, p);
  } catch {}
}

export function customRegistryEntry(p: CustomPlugin): PluginMeta {
  return {
    id: CUSTOM_PLUGIN_ID,
    settingsName: "CustomUserPlugin",
    name: p.name || "Свой плагин",
    author: "пользователь",
    description: p.url,
    repo: p.url,
    scriptUrl: p.url,
  };
}

/** Резолв меты: реестр + кастомный слот. */
export async function resolvePluginMeta(
  id: string,
  registry: PluginMeta[],
): Promise<PluginMeta | undefined> {
  const found = registry.find((m) => m.id === id);
  if (found) return found;
  if (id === CUSTOM_PLUGIN_ID) {
    const custom = await getCustomPlugin();
    if (custom) return customRegistryEntry(custom);
  }
  return undefined;
}
