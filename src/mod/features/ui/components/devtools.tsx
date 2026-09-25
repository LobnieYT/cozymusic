import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Alert, AlertDescription } from "@ui/components/ui/alert";

import { Info, Code } from "lucide-react";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { toast } from "sonner";

import {
  CUSTOM_PLUGIN_ID,
  getCustomPlugin,
  setCustomPlugin,
  resolvePluginMeta,
  type CustomPlugin,
} from "~/mod/features/plugins/custom";
import {
  enablePlugin,
  disablePlugin,
  getEnabledPluginIds,
  setEnabledPluginIds,
} from "~/mod/features/plugins/loader";
import { PLUGIN_REGISTRY } from "~/mod/features/plugins/registry";

export function Devtools() {
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);
  const [systemToolbarEnabled, setSystemToolbarEnabled] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  const [customName, setCustomName] = useState("");
  const [custom, setCustom] = useState<CustomPlugin | null>(null);
  const [customEnabled, setCustomEnabled] = useState(false);

  const refreshCustom = async () => {
    try {
      const c = await getCustomPlugin();
      setCustom(c);
      if (c) setCustomUrl(c.url);
      const ids = await getEnabledPluginIds();
      setCustomEnabled(ids.includes(CUSTOM_PLUGIN_ID));
    } catch {}
  };

  useEffect(() => {
    (async () => {
      setDevtoolsEnabled((await window.yandexMusicMod.getStorageValue("devtools/enabled")) || false);
      setSystemToolbarEnabled((await window.yandexMusicMod.getStorageValue("devtools/systemToolbar")) || false);
      await refreshCustom();
    })();
  }, []);

  const saveCustom = async () => {
    const url = customUrl.trim();
    if (!url) {
      toast.error("Вставь URL .js файла плагина");
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith("data:text/javascript")) {
      toast.error("Нужен http(s) URL или data: URL");
      return;
    }
    const plugin: CustomPlugin = { name: customName.trim() || "Свой плагин", url };
    await setCustomPlugin(plugin);
    setCustom(plugin);
    toast.success("Свой плагин сохранён");
  };

  const toggleCustom = async (next: boolean) => {
    const meta = await resolvePluginMeta(CUSTOM_PLUGIN_ID, PLUGIN_REGISTRY);
    if (next && !meta) {
      toast.error("Сначала добавь URL плагина");
      return;
    }
    if (next && meta) {
      try {
        await enablePlugin(meta);
      } catch (e) {
        console.error("[plugins] custom enable failed:", e);
        toast.error("Не удалось включить свой плагин");
        return;
      }
    } else {
      disablePlugin(CUSTOM_PLUGIN_ID);
    }
    const ids = await getEnabledPluginIds();
    const nextIds = next ? [...ids.filter((x) => x !== CUSTOM_PLUGIN_ID), CUSTOM_PLUGIN_ID] : ids.filter((x) => x !== CUSTOM_PLUGIN_ID);
    setCustomEnabled(next);
    await setEnabledPluginIds(nextIds);
  };

  const deleteCustom = async () => {
    disablePlugin(CUSTOM_PLUGIN_ID);
    const ids = await getEnabledPluginIds();
    await setEnabledPluginIds(ids.filter((x) => x !== CUSTOM_PLUGIN_ID));
    await setCustomPlugin(null);
    setCustom(null);
    setCustomEnabled(false);
    setCustomUrl("");
    toast.success("Свой плагин удалён");
  };

  return (
    <ExpandableCard title="Для разработчиков" icon={<Code className="h-4 w-4" />}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="devtools-toggle"
            checked={devtoolsEnabled}
            onCheckedChange={(enabled) => {
              setDevtoolsEnabled(enabled);
              window.yandexMusicMod.setStorageValue("devtools/enabled", enabled);
            }}
          />
          <Label htmlFor="devtools-toggle" className="cursor-pointer">
            Включить режим разработчика
          </Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="systemToolbar-toggle"
            checked={systemToolbarEnabled}
            onCheckedChange={(enabled) => {
              setSystemToolbarEnabled(enabled);
              window.yandexMusicMod.setStorageValue("devtools/systemToolbar", enabled);
            }}
          />
          <Label htmlFor="systemToolbar-toggle" className="cursor-pointer">
            Включить системную рамку окна
          </Label>
        </div>

        <Alert variant="default" className="cursor-default">
          <Info />
          <AlertDescription>Потребуется перезапуск</AlertDescription>
        </Alert>

        <div className="flex flex-col gap-2 rounded-lg border p-2">
          <Label className="font-semibold">Свой плагин (.js по URL)</Label>
          <Input
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Название (необязательно)"
          />
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://…/plugin.js"
          />
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={saveCustom}>
              Сохранить
            </Button>
            {custom && (
              <Button variant="outline" onClick={deleteCustom}>
                Удалить
              </Button>
            )}
          </div>
          {custom && (
            <div className="flex items-center gap-3">
              <Switch id="custom-plugin-toggle" checked={customEnabled} onCheckedChange={toggleCustom} />
              <Label htmlFor="custom-plugin-toggle" className="cursor-pointer">
                Включён: {custom.name}
              </Label>
            </div>
          )}
          <span className="text-muted-foreground text-xs">
            Выполняется как обычный скрипт страницы. Включай только код, которому доверяешь.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              try {
                const res = await (window as any).yandexMusicMod.toggleDevTools();
                if (!res?.success) toast.error("Не удалось открыть DevTools");
              } catch {
                toast.error("Не удалось открыть DevTools");
              }
            }}
          >
            Открыть DevTools
          </Button>
        </div>
        <span className="text-muted-foreground text-xs">
          Работает и на Wayland. Лог ошибок: файл cozy-renderer.log в папке данных приложения.
        </span>
      </div>
    </ExpandableCard>
  );
}
