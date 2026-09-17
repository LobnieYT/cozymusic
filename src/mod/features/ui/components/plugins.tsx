import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Button } from "@ui/components/ui/button";
import { Slider } from "@ui/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";

import { Puzzle, AlertTriangle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { PLUGIN_REGISTRY, type PluginMeta } from "~/mod/features/plugins/registry";
import {
  enablePlugin,
  disablePlugin,
  getEnabledPluginIds,
  setEnabledPluginIds,
  fetchPluginMeta,
  fetchPluginHandles,
  defaultsFromHandles,
  type PluginHandles,
} from "~/mod/features/plugins/loader";
import { hydratePluginSettings, setPluginSetting } from "~/mod/features/plugins/pulsesync-shim";
import { WALLPAPER_KEYS } from "~/mod/features/wallpapers/wallpapers";

const WARNING_TEXT = "ВНИМАНИЕ! Данная функция находится в тестировании и крайне нестабильна. Используйте на свой страх и риск!";

async function isWallpapersEnabled(): Promise<boolean> {
  try {
    return (await (window as any).yandexMusicMod.getStorageValue(WALLPAPER_KEYS.enabled)) === true;
  } catch {
    return false;
  }
}

function PluginCard({ meta, enabled, onToggle }: { meta: PluginMeta; enabled: boolean; onToggle: (id: string, next: boolean) => void }) {
  const [live, setLive] = useState<Partial<PluginMeta>>({});
  const [handles, setHandles] = useState<PluginHandles | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, h] = await Promise.all([fetchPluginMeta(meta), fetchPluginHandles(meta)]);
      if (!alive) return;
      setLive(m);
      setHandles(h);
      await hydratePluginSettings(meta.settingsName, defaultsFromHandles(h));
      try {
        const saved = await (window as any).yandexMusicMod.getStorageValue(`plugins/settings/${meta.settingsName}`);
        if (saved && typeof saved === "object") setValues(saved);
        else if (h) {
          const d: Record<string, any> = {};
          for (const s of h.sections || []) for (const it of s.items || []) {
            if (it?.id) d[it.id] = it.defaultParameter !== undefined ? it.defaultParameter : it.value;
          }
          setValues(d);
        }
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [meta.id]);

  const changeSetting = async (settingId: string, value: any) => {
    setValues((prev) => ({ ...prev, [settingId]: value }));
    setPluginSetting(meta.settingsName, settingId, value);
  };

  return (
    <ExpandableCard
      title={live.name || meta.name}
      icon={<Puzzle className="h-4 w-4" />}
    >
      <div className="flex flex-col gap-3 pt-2 px-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground text-xs">
              {live.author || meta.author} • {meta.id === "slopless" ? "v1.3.0 (vendored)" : "GitHub"}
            </span>
            <span className="text-sm">{live.description || meta.description}</span>
            <button
              className="text-muted-foreground hover:text-foreground mt-1 flex w-fit cursor-pointer items-center gap-1 text-xs underline"
              onClick={() => window.open(meta.repo, "_blank", "noreferrer")}
            >
              <ExternalLink className="h-3 w-3" />
              {meta.repo.replace("https://github.com/", "")}
            </button>
          </div>
          <Switch
            id={`plugin-toggle-${meta.id}`}
            checked={enabled}
            onCheckedChange={(value) => onToggle(meta.id, value)}
          />
        </div>

        {enabled && handles && handles.sections?.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border p-2">
            {handles.sections.map((section, si) => (
              <div key={si} className="flex flex-col gap-2">
                {section.title && (
                  <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
                    {section.title}
                  </span>
                )}
                {(section.items || []).map((item) => {
                  if (!item?.id) return null;
                  const val = values[item.id] ?? item.defaultParameter ?? item.value;
                  if (item.type === "button") {
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        <Switch
                          id={`plugin-${meta.id}-${item.id}`}
                          checked={val === true || val === "true"}
                          onCheckedChange={(v) => changeSetting(item.id, v)}
                        />
                        <div className="flex flex-col">
                          <Label htmlFor={`plugin-${meta.id}-${item.id}`} className="cursor-pointer">
                            {item.name}
                          </Label>
                          {item.description && (
                            <span className="text-muted-foreground text-xs">{item.description}</span>
                          )}
                        </div>
                      </div>
                    );
                  }
                  if (item.type === "slider") {
                    const num = typeof val === "number" ? val : Number(val ?? item.min ?? 0);
                    return (
                      <div key={item.id} className="flex flex-col gap-1">
                        <Label>
                          {item.name}: {num}
                        </Label>
                        <Slider
                          value={[isNaN(num) ? 0 : num]}
                          min={item.min ?? 0}
                          max={item.max ?? 100}
                          step={item.step ?? 1}
                          onValueChange={(v) => changeSetting(item.id, v[0])}
                        />
                        {item.description && (
                          <span className="text-muted-foreground text-xs">{item.description}</span>
                        )}
                      </div>
                    );
                  }
                  if (item.type === "selector") {
                    const opts: { id: string; name: string }[] = ((item as any).options || []).map((o: any) =>
                      typeof o === "string" ? { id: o, name: o } : { id: o.id, name: o.name || o.id },
                    );
                    return (
                      <div key={item.id} className="flex flex-col gap-1">
                        <Label>{item.name}</Label>
                        <Select value={String(val ?? "")} onValueChange={(v) => changeSetting(item.id, v)}>
                          <SelectTrigger className="text-foreground w-full">
                            <SelectValue placeholder={item.name} />
                          </SelectTrigger>
                          <SelectContent>
                            {opts.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}

export function PluginsDev() {
  const [enabledIds, setEnabledIds] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setEnabledIds(await getEnabledPluginIds());
    })();
  }, []);

  const toggle = async (id: string, next: boolean) => {
    const meta = PLUGIN_REGISTRY.find((m) => m.id === id);
    if (!meta) return;

    if (next) {
      // Взаимоблокировка с обоями мода
      if (meta.isCustomBackground && (await isWallpapersEnabled())) {
        toast.error('Выключите функцию "обои на фоне Яндекс Музыки"');
        return;
      }
      try {
        await enablePlugin(meta);
      } catch (e) {
        console.error(`[plugins] enable failed: ${meta.name}`, e);
        toast.error(`Не удалось включить плагин ${meta.name}`);
        return;
      }
    } else {
      disablePlugin(id);
    }

    const nextIds = next ? [...enabledIds.filter((x) => x !== id), id] : enabledIds.filter((x) => x !== id);
    setEnabledIds(nextIds);
    await setEnabledPluginIds(nextIds);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="m-3 mb-0 flex flex-row items-start gap-3 rounded-xl border-2 border-red-500/70 bg-red-500/10 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
        <span className="text-sm leading-snug font-bold text-red-300">{WARNING_TEXT}</span>
      </div>
      {PLUGIN_REGISTRY.map((meta) => (
        <PluginCard key={meta.id} meta={meta} enabled={enabledIds.includes(meta.id)} onToggle={toggle} />
      ))}
      <div className="px-4 pb-1">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open("https://github.com/LobnieYT/cozymusic", "_blank", "noreferrer")}
        >
          Предложить свой плагин
        </Button>
      </div>
    </div>
  );
}
