import type { PluginMeta } from "./registry";

export const CUSTOM_PLUGIN_ID = "custom-user-plugin";
const CUSTOM_KEY = "plugins/custom";
const MAX_CODE_SIZE = 2 * 1024 * 1024;

export interface CustomPlugin {
  name: string;
  /** исходник .js, хранится локально в настройках (без внешних URL) */
  code: string;
}

export async function getCustomPlugin(): Promise<CustomPlugin | null> {
  try {
    const v = await window.yandexMusicMod.getStorageValue(CUSTOM_KEY);
    if (v && typeof v.code === "string" && v.code.length > 0) {
      return { name: String(v.name || "Свой плагин"), code: v.code };
    }
  } catch {}
  return null;
}

export async function setCustomPlugin(p: CustomPlugin | null) {
  try {
    await window.yandexMusicMod.setStorageValue(CUSTOM_KEY, p);
  } catch {}
}

/** Код для выполнения: только локально сохранённый, без сети. */
export async function fetchCustomCode(): Promise<string> {
  const custom = await getCustomPlugin();
  if (!custom) throw new Error("no_custom_plugin");
  if (custom.code.length > MAX_CODE_SIZE) throw new Error("too_big");
  return custom.code;
}

export function customRegistryEntry(p: CustomPlugin): PluginMeta {
  return {
    id: CUSTOM_PLUGIN_ID,
    settingsName: "CustomUserPlugin",
    name: p.name || "Свой плагин",
    author: "пользователь",
    description: "Локальный .js файл с этого компьютера",
    repo: "",
    scriptUrl: "",
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
