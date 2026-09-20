import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { getAccountSettings, updateAccountSettings } from "~/mod/features/utils/api";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { toast } from "sonner";

import { AiOutlineExperiment } from "react-icons/ai";
import { Settings as SettingsIcon } from "lucide-react";
import { ErrorBoundary } from "@ui/components/ui/error-boundary";

import { MEDIA_BIND_ACTIONS, MEDIA_BIND_DEFAULTS, MEDIA_BINDS_ENABLED_KEY, MEDIA_BIND_KEY } from "~/mod/features/media-binds";

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  e.preventDefault();
  e.stopPropagation();
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key === "Escape") key = "Esc";
  else if (key.startsWith("Arrow")) key = key.slice(5);
  else if (key.length === 1) key = key.toUpperCase();
  // медиаклавиши (MediaPlayPause, AudioVolumeUp...) — как есть
  parts.push(key);
  if (parts.length === 1 && !/^(F\d{1,2}|Media\w+|Audio\w+|Space|Up|Down|Left|Right|Esc|Tab|Delete|Home|End|PageUp|PageDown|Insert)$/.test(key)) {
    return null;
  }
  return parts.join("+");
}

export function Settings() {
  const [bindsEnabled, setBindsEnabled] = useState(true);
  const [binds, setBinds] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState<string | null>(null);
  const [autostart, setAutostart] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setBindsEnabled((await window.yandexMusicMod.getStorageValue(MEDIA_BINDS_ENABLED_KEY)) !== false);
        const next: Record<string, string> = {};
        for (const a of MEDIA_BIND_ACTIONS) {
          next[a.id] =
            (await window.yandexMusicMod.getStorageValue(MEDIA_BIND_KEY(a.id))) || MEDIA_BIND_DEFAULTS[a.id];
        }
        setBinds(next);
        const auto = await window.yandexMusicMod.getAutostart();
        if (auto?.success) setAutostart(!!auto.enabled);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const handler = (e: KeyboardEvent) => {
      const acc = keyEventToAccelerator(e);
      if (!acc) return;
      (async () => {
        setBinds((prev) => ({ ...prev, [recording]: acc }));
        await window.yandexMusicMod.setStorageValue(MEDIA_BIND_KEY(recording), acc);
        await window.yandexMusicMod.refreshShortcuts().catch(() => {});
        setRecording(null);
      })();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording]);

  const resetBind = async (actionId: string) => {
    const def = MEDIA_BIND_DEFAULTS[actionId];
    setBinds((prev) => ({ ...prev, [actionId]: def }));
    await window.yandexMusicMod.setStorageValue(MEDIA_BIND_KEY(actionId), def);
    await window.yandexMusicMod.refreshShortcuts().catch(() => {});
  };
  async function handleCopyAuthData() {
    const accessToken = localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null;

    const experimentsResponse = await axios.get("https://api.music.yandex.net/account/experiments/details", {
      method: "GET",
      headers: {
        "x-yandex-music-client": "YandexMusicDesktopAppWindows/" + window.VERSION,
        "x-yandex-music-without-invocation-info": "1",
        Authorization: accessToken,
      },
    });

    if (experimentsResponse.status !== 200) {
      console.error("Failed to save experiments", experimentsResponse.status);
      return;
    }

    const data = {
      accessToken: localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null,
      experiments: experimentsResponse.data,
    };

    toast.success("Данные авторизации скопированы");

    return navigator.clipboard.writeText(JSON.stringify(data));
  }

  return (
    <ExpandableCard title="Настройки" icon={<SettingsIcon className="h-4 w-4" />}>
      <ErrorBoundary label="Настройки">
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="settings-autostart-toggle"
            checked={autostart}
            onCheckedChange={async (enabled) => {
              setAutostart(enabled);
              await window.yandexMusicMod.setStorageValue("autostart/enabled", enabled);
              await window.yandexMusicMod.setAutostart(enabled).catch(() => {});
            }}
          />
          <Label htmlFor="settings-autostart-toggle" className="cursor-pointer">
            Автозапуск при включении компьютера
          </Label>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border p-2">
          <div className="flex items-center gap-3">
            <Switch
              id="settings-binds-toggle"
              checked={bindsEnabled}
              onCheckedChange={async (enabled) => {
                setBindsEnabled(enabled);
                await window.yandexMusicMod.setStorageValue(MEDIA_BINDS_ENABLED_KEY, enabled);
                await window.yandexMusicMod.refreshShortcuts().catch(() => {});
              }}
            />
            <Label htmlFor="settings-binds-toggle" className="cursor-pointer font-semibold">
              Бинды (глобальные горячие клавиши)
            </Label>
          </div>
          {MEDIA_BIND_ACTIONS.map((a) => (
            <div key={a.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{a.label}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 min-w-[110px] px-2 font-mono text-xs"
                disabled={!bindsEnabled}
                onClick={() => setRecording(recording === a.id ? null : a.id)}
              >
                {recording === a.id ? "Нажми клавиши…" : binds[a.id] || "—"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={!bindsEnabled}
                title="Сбросить"
                onClick={() => resetBind(a.id)}
              >
                ↺
              </Button>
            </div>
          ))}
          <span className="text-muted-foreground text-xs">
            Нажми на бинд и нажми сочетание клавиш. Медиаклавиши поддерживаются.
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger className="w-full">
              <Button onClick={handleCopyAuthData} className="w-full">
                Скопировать данные авторизации
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Если разработчик попросит вас дать доступ к своему аккаунту, вы можете поделиться этими данными.</p>
              <p>Не передавайте их кому-либо еще.</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      </ErrorBoundary>
    </ExpandableCard>
  );
}
