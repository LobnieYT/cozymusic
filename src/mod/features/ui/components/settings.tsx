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
import {
  MEDIA_BIND_KEY_2,
  MOUSE_BUTTONS,
  formatBind,
  isMouseBind,
} from "~/mod/features/media-binds/mouse-binds";

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
  // медиаклавиши (MediaPlayPause, ...) и одиночные клавиши (WASD...) — как есть
  parts.push(key);
  if (parts.length === 1 && !/^(F\d{1,2}|Media\w+|Audio\w+|Space|Up|Down|Left|Right|Esc|Tab|Delete|Home|End|PageUp|PageDown|Insert|[A-Z0-9])$/.test(key)) {
    return null;
  }
  return parts.join("+");
}

function mouseEventToBind(e: MouseEvent): string | null {
  // ЛКМ (0) и ПКМ (2) запрещены — иначе убьём обычные клики
  if (e.button === 0 || e.button === 2) return null;
  const label = MOUSE_BUTTONS[e.button];
  if (!label) return null;
  e.preventDefault();
  e.stopPropagation();
  return label;
}

export function Settings() {
  const [bindsEnabled, setBindsEnabled] = useState(true);
  const [binds, setBinds] = useState<Record<string, string>>({});
  // recording: какой слот слушаем; pending: что поймали, ждёт подтверждения
  const [recording, setRecording] = useState<{ action: string; slot: 0 | 1 } | null>(null);
  const [pending, setPending] = useState<{ action: string; slot: 0 | 1; value: string } | null>(null);
  const [autostart, setAutostart] = useState(false);

  const slotKey = (actionId: string, slot: 0 | 1) => (slot === 0 ? MEDIA_BIND_KEY(actionId) : MEDIA_BIND_KEY_2(actionId));

  useEffect(() => {
    (async () => {
      try {
        setBindsEnabled((await window.yandexMusicMod.getStorageValue(MEDIA_BINDS_ENABLED_KEY)) !== false);
        const next: Record<string, string> = {};
        for (const a of MEDIA_BIND_ACTIONS) {
          next[`${a.id}:0`] =
            (await window.yandexMusicMod.getStorageValue(MEDIA_BIND_KEY(a.id))) || MEDIA_BIND_DEFAULTS[a.id];
          next[`${a.id}:1`] = (await window.yandexMusicMod.getStorageValue(MEDIA_BIND_KEY_2(a.id))) || "";
        }
        setBinds(next);
        const auto = await window.yandexMusicMod.getAutostart();
        if (auto?.success) setAutostart(!!auto.enabled);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      const acc = keyEventToAccelerator(e);
      if (!acc) return;
      setPending({ action: recording.action, slot: recording.slot, value: acc });
    };
    const onMouse = (e: MouseEvent) => {
      // ЛКМ/ПКМ не перехватываем даже при записи
      if (e.button === 0 || e.button === 2) return;
      const label = mouseEventToBind(e);
      if (!label) return;
      setPending({ action: recording.action, slot: recording.slot, value: label });
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
    };
  }, [recording]);

  const confirmPending = async () => {
    if (!pending) return;
    const key = slotKey(pending.action, pending.slot);
    setBinds((prev) => ({ ...prev, [`${pending.action}:${pending.slot}`]: pending.value }));
    await window.yandexMusicMod.setStorageValue(key, pending.value);
    await window.yandexMusicMod.refreshShortcuts().catch(() => {});
    setPending(null);
    setRecording(null);
  };

  const cancelPending = () => {
    setPending(null);
    setRecording(null);
  };

  const clearSlot = async (actionId: string, slot: 0 | 1) => {
    const key = slotKey(actionId, slot);
    setBinds((prev) => ({ ...prev, [`${actionId}:${slot}`]: "" }));
    await window.yandexMusicMod.setStorageValue(key, "");
    await window.yandexMusicMod.refreshShortcuts().catch(() => {});
  };

  const resetBind = async (actionId: string) => {
    const def = MEDIA_BIND_DEFAULTS[actionId] || "";
    setBinds((prev) => ({ ...prev, [`${actionId}:0`]: def, [`${actionId}:1`]: "" }));
    await window.yandexMusicMod.setStorageValue(MEDIA_BIND_KEY(actionId), def);
    await window.yandexMusicMod.setStorageValue(MEDIA_BIND_KEY_2(actionId), "");
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
            <div key={a.id} className="flex flex-col gap-1.5 rounded-lg border border-transparent p-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm">{a.label}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={!bindsEnabled}
                  title="Сбросить обе комбинации"
                  onClick={() => resetBind(a.id)}
                >
                  ↺
                </Button>
              </div>
              {([0, 1] as const).map((slot) => {
                const isPending = pending?.action === a.id && pending?.slot === slot;
                const isRecording = recording?.action === a.id && recording?.slot === slot;
                return (
                  <div key={slot} className="flex items-center gap-2 pl-1">
                    <span className="text-muted-foreground w-8 shrink-0 text-xs">#{slot + 1}</span>
                    {isPending ? (
                      <>
                        <span className="flex-1 truncate rounded-md border border-violet-400/60 bg-violet-500/10 px-2 py-1 font-mono text-xs">
                          {formatBind(pending.value)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-emerald-300"
                          title="Подтвердить"
                          onClick={confirmPending}
                        >
                          ✓
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-300"
                          title="Отменить"
                          onClick={cancelPending}
                        >
                          ✗
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 flex-1 truncate px-2 font-mono text-xs"
                          disabled={!bindsEnabled}
                          onClick={() => setRecording(isRecording ? null : { action: a.id, slot })}
                        >
                          {isRecording ? "Нажми клавишу/кнопку…" : formatBind(binds[`${a.id}:${slot}`])}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          disabled={!bindsEnabled}
                          title="Очистить слот"
                          onClick={() => clearSlot(a.id, slot)}
                        >
                          ✕
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <span className="text-muted-foreground text-xs">
            Два слота на действие: клавиатура (включая WASD и одиночные клавиши) или кнопки мыши — средняя, X1, X2 (ЛКМ/ПКМ запрещены). Кнопки мыши работают, когда окно приложения в фокусе. Одиночные клавиши перехватываются глобально — аккуратнее с ними.
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
