import { ThemeProvider } from "./contexts/ThemeContext";

import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@ui/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@ui/components/ui/sonner";
import { toast } from "sonner";

import { Playground } from "@ui/components/playground";
import { IPChecker } from "@ui/components/ip-checker";
import { FontChanger } from "@ui/components/font-changer";
import { Devtools } from "@ui/components/devtools";
import { Downloader } from "@ui/components/downloader";
import { AutoBestQuality } from "@ui/components/auto-best-quality";
import { DiscordRPC } from "@ui/components/discord-rpc";
import { Settings } from "@ui/components/settings";
import { AutoLiker } from "@ui/components/auto-liker";
import { ExperimentsToggle } from "@ui/components/experiments-toggle";
import { ScaleChanger } from "@ui/components/scale-changer";
import { LyricsSource } from "@ui/components/lyrics-source";
import { CustomThemes } from "@ui/components/custom-themes";
import { Wallpapers, WindowOpacity } from "@ui/components/wallpapers";
import { PluginsDev } from "@ui/components/plugins";
import { NewYearSnowfallAnimation } from "@ui/components/snowfall-animation";

import { Button } from "./components/ui/button";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { ExpandedByDefaultContext } from "./components/ui/expandable-card";

import logo from "@ui/assets/cozy-logo.png?inline";
import donateLogo from "@ui/assets/donate-logo.png?inline";
import discordBg from "@ui/assets/discord-bg.png?inline";

import { FaDiscord, FaGithub } from "react-icons/fa";
import { Power, Download, Volume2, Heart, MicVocal, Palette, Type, Scaling, Gamepad2, Settings as SettingsIcon, Wrench, FlaskConical, Puzzle, RefreshCw } from "lucide-react";

const IS_DEV = false;
const DISCORD_INVITE_URL = "https://discord.gg/mS5WJfWEht";
const GITHUB_REPO_URL = "https://github.com/LobnieYT/cozymusic";
const DONATE_URL = "https://www.donationalerts.com/r/cozyproject";

type MenuKey =
  | "downloader"
  | "quality"
  | "liker"
  | "lyrics"
  | "themes"
  | "fonts"
  | "scale"
  | "discord"
  | "settings"
  | "devtools"
  | "experiments"
  | "plugins";

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="px-2 pt-1 text-[10px] font-bold tracking-[0.18em] text-violet-200/70 uppercase">{title}</span>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-medium transition-all " +
        (active
          ? "bg-gradient-to-r from-violet-500/40 to-fuchsia-500/25 text-white shadow-sm"
          : "text-muted-foreground hover:bg-white/5 hover:text-white")
      }
    >
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

export default function App() {
  const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(IS_DEV);
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);
  const [selected, setSelected] = useState<MenuKey>("downloader");
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [isFlatpakEnv, setIsFlatpakEnv] = useState(false);
  const [isWinEnv, setIsWinEnv] = useState(false);

  async function queryUpdateInfo() {
    try {
      const res = await (window as any).yandexMusicMod.checkUpdate(import.meta.env.VITE_MOD_VERSION);
      if (res?.success && res.updateAvailable) {
        setUpdateAvailable(true);
        return res;
      }
      return res;
    } catch {
      return { success: false };
    }
  }

  // тихая проверка при старте меню — только выставляет бейдж
  useEffect(() => {
    queryUpdateInfo();
    (async () => {
      try {
        const env = await (window as any).yandexMusicMod.getEnv();
        if (env?.success) {
          setIsFlatpakEnv(!!env.flatpak);
          setIsWinEnv(env.platform === "win32");
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUpdateClick() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const info: any = await queryUpdateInfo();
      if (!info?.success) {
        toast.error("Не удалось проверить обновления");
        return;
      }
      if (!info.updateAvailable) {
        toast.success("У вас уже последняя версия :)");
        return;
      }
      const assets: any[] = info.assets || [];
      const pickAsset = (): any => {
        if (isWinEnv) {
          return assets.find((a) => a.name.endsWith(".exe")) || assets[0];
        }
        if (isFlatpakEnv) {
          return assets.find((a) => a.name.endsWith(".flatpak")) || assets[0];
        }
        const snap = assets.find((a) => a.name.includes("_amd64.snap"));
        if (snap) return snap;
        return assets.find((a) => a.name.endsWith(".flatpak")) || assets[0];
      };
      const asset = pickAsset();
      if (!asset) {
        toast.error("Подходящий файл обновления не найден");
        return;
      }
      const toastId = toast.loading(`Скачиваю ${info.latest}…`);
      const res: any = await (window as any).yandexMusicMod.installUpdate(asset.url, asset.name);
      toast.dismiss(toastId);
      if (res?.success && res?.method === "win-installer") {
        toast.success("Установщик запущен! Приложение закроется…");
        return;
      }
      if (res?.success) {
        toast.success("Обновление установлено! Перезапускаю…");
        setTimeout(() => (window as any).yandexMusicMod.restartApp(), 1500);
      } else if (res?.needManual) {
        toast.error("Нужна ручная установка", {
          description: res.command || res.file || "",
          duration: 10000,
        });
      } else {
        toast.error("Не удалось установить обновление");
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  useEffect(() => {
    (async () => {
      setDevtoolsEnabled((await window.yandexMusicMod.getStorageValue("devtools/enabled")) || false);
    })();

    window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
      if (key.includes("devtools/enabled")) setDevtoolsEnabled(value);
    });
  }, []);

  useEffect(() => {
    const targetSelector = 'div[class*="NavbarDesktopUserWidget_userProfileContainer"]';
    const containerId = "mod-sheet-container";

    const checkAndPlaceButton = () => {
      const targetElement = IS_DEV ? document.body : document.querySelector(targetSelector);
      let container = document.getElementById(containerId) as HTMLDivElement | null;

      if (targetElement) {
        if (!container) {
          container = document.createElement("div");
          container.id = containerId;
          container.style.display = "flex";
          container.style.justifyContent = "center";

          targetElement.parentNode?.insertBefore(container, targetElement);
        }
        setMountNode(container);
      } else {
        if (container) {
          container.remove();
        }
        setMountNode(null);
      }
    };

    checkAndPlaceButton();

    const observer = new MutationObserver(checkAndPlaceButton);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      const container = document.getElementById(containerId);
      if (container) {
        container.remove();
      }
    };
  }, []);

  const sheetTrigger = (
    <>
      <div className="cozy-trigger-wrap">
        <SheetTrigger className="cozy-trigger-inner">
          <div
            className="cozy-trigger-logo"
            style={{
              backgroundImage: `url(${logo})`,
            }}
          ></div>
          <span className="cozy-trigger-text trigger-text lg:inline">CozyMusic</span>
          <Toaster position="bottom-right" />
        </SheetTrigger>
      </div>

      <NewYearSnowfallAnimation />
    </>
  );

  return (
    <ThemeProvider>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        {mountNode && createPortal(sheetTrigger, mountNode)}
        <SheetContent side="center" className="w-full" onOpenAutoFocus={(e) => e.preventDefault()}>
          <ErrorBoundary label="Меню CozyMusic">
          <div
            id="header"
            className="flex items-center justify-between px-4"
            style={{
              height: "var(--ym-spacer-size-xxxl)",
              backgroundColor: "var(--ym-background-color-primary-enabled-basic)",
            }}
          ></div>

          <div
            className="relative m-3 mb-0 overflow-hidden rounded-2xl border border-violet-400/40 px-4 py-3 shadow-[0_0_28px_-6px_rgba(167,139,250,0.5)]"
            style={{
              background:
                "linear-gradient(115deg, rgba(109,40,217,0.38) 0%, rgba(192,38,211,0.20) 48%, rgba(30,27,75,0.45) 100%)",
            }}
          >
            <div className="pointer-events-none absolute -top-12 -left-12 h-32 w-32 rounded-full bg-fuchsia-500/25 blur-2xl" />
            <div className="pointer-events-none absolute -right-10 -bottom-12 h-32 w-32 rounded-full bg-violet-500/30 blur-2xl" />
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/60 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-xl bg-white/10 bg-contain bg-no-repeat p-1 shadow-inner backdrop-blur"
                  style={{
                    backgroundImage: `url(${logo})`,
                    backgroundOrigin: "content-box",
                  }}
                />
                <div className="flex flex-col leading-tight">
                  <span className="flex items-center gap-2 bg-gradient-to-r from-violet-100 via-fuchsia-200 to-violet-100 bg-clip-text text-lg font-black tracking-wider text-transparent drop-shadow-[0_0_12px_rgba(217,70,239,0.35)]">
                    CozyMusic
                    {updateAvailable && (
                      <span className="animate-pulse rounded-full border border-emerald-300/50 bg-emerald-400/15 px-2 py-px text-[10px] font-bold whitespace-nowrap text-emerald-200">
                        Вышло новое обновление!
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className="rounded-full border border-fuchsia-300/40 bg-fuchsia-400/15 px-2 py-px text-[10px] font-bold text-fuchsia-100">
                      v{import.meta.env.VITE_MOD_VERSION}
                    </span>
                    <span className="text-muted-foreground text-[11px] font-semibold">мод для Яндекс Музыки</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative border-emerald-300/30 bg-emerald-400/10 backdrop-blur hover:bg-emerald-400/25"
                      onClick={handleUpdateClick}
                      disabled={checkingUpdate}
                    >
                      <RefreshCw className={`text-foreground h-[1.3rem]! w-[1.3rem]! ${checkingUpdate ? "animate-spin" : ""}`} />
                      {updateAvailable && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.7)]" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Обновить CozyMusic</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-white/15 bg-white/5 backdrop-blur hover:bg-white/15"
                      onClick={() => window.open(DISCORD_INVITE_URL, "_blank", "noreferrer")}
                    >
                      <FaDiscord className="h-[1.3rem]! w-[1.3rem]! text-[#8b9cf5]" fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Discord сервер</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-white/15 bg-white/5 backdrop-blur hover:bg-white/15"
                      onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noreferrer")}
                    >
                      <FaGithub className="text-foreground h-[1.3rem]! w-[1.3rem]!" fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Исходный код на Github</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      className="border-amber-300/30 bg-amber-400/10 backdrop-blur hover:bg-amber-400/25"
                      onClick={() => window.open(DONATE_URL, "_blank", "noreferrer")}
                    >
                      <div
                        className="h-[1.3rem]! w-[1.3rem]! bg-contain bg-no-repeat"
                        style={{ backgroundImage: `url(${donateLogo})` }}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>На чашечку кофе</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 gap-2 px-3">
            <div className="flex w-[148px] shrink-0 flex-col gap-2 overflow-y-auto py-1 pr-1">
              <MenuSection title="Музыка">
                <NavButton active={selected === "downloader"} icon={<Download />} label="Скачать треки" onClick={() => setSelected("downloader")} />
                <NavButton active={selected === "quality"} icon={<Volume2 />} label="Качество" onClick={() => setSelected("quality")} />
                <NavButton active={selected === "liker"} icon={<Heart />} label="Лайки" onClick={() => setSelected("liker")} />
                <NavButton active={selected === "lyrics"} icon={<MicVocal />} label="Тексты песен" onClick={() => setSelected("lyrics")} />
              </MenuSection>

              <MenuSection title="Внешний вид">
                <NavButton active={selected === "themes"} icon={<Palette />} label="Темы" onClick={() => setSelected("themes")} />
                <NavButton active={selected === "fonts"} icon={<Type />} label="Шрифты" onClick={() => setSelected("fonts")} />
                <NavButton active={selected === "scale"} icon={<Scaling />} label="Масштаб" onClick={() => setSelected("scale")} />
              </MenuSection>

              <MenuSection title="Интеграции">
                <NavButton active={selected === "discord"} icon={<Gamepad2 />} label="Discord" onClick={() => setSelected("discord")} />
              </MenuSection>

              <MenuSection title="Система">
                <NavButton active={selected === "settings"} icon={<SettingsIcon />} label="Настройки" onClick={() => setSelected("settings")} />
                <NavButton active={selected === "devtools"} icon={<Wrench />} label="Devtools" onClick={() => setSelected("devtools")} />
                {devtoolsEnabled && (
                  <NavButton active={selected === "experiments"} icon={<FlaskConical />} label="Эксперименты" onClick={() => setSelected("experiments")} />
                )}
                <NavButton active={selected === "plugins"} icon={<Puzzle />} label="Плагины" onClick={() => setSelected("plugins")} />
              </MenuSection>
            </div>

            <div className="bg-secondary/20 min-h-0 flex-1 overflow-hidden rounded-xl border">
              <ScrollArea
                className="flex h-full flex-col overflow-hidden overflow-x-auto overflow-y-auto rounded-xl"
                viewportClassName="gap-2 p-2"
              >
                <ExpandedByDefaultContext.Provider value={true}>
                {/* Проверка IP адреса на геолокацию, отключил за ненадобностью */}
                {/* {devtoolsEnabled && <IPChecker />} */}

                {selected === "downloader" && <Downloader />}
                {selected === "quality" && <AutoBestQuality />}
                {selected === "liker" && <AutoLiker />}
                {selected === "lyrics" && <LyricsSource />}

                {selected === "themes" && <CustomThemes />}
                {selected === "themes" && <Wallpapers />}
                {selected === "themes" && <WindowOpacity />}
                {selected === "fonts" && <FontChanger />}
                {selected === "scale" && <ScaleChanger />}

                {selected === "discord" && <DiscordRPC />}

                {selected === "settings" && <Settings />}
                {selected === "devtools" && <Devtools />}
                {selected === "experiments" && devtoolsEnabled && <ExperimentsToggle />}
                {selected === "plugins" && <PluginsDev />}
                {/* {devtoolsEnabled && <Playground />} */}
                </ExpandedByDefaultContext.Provider>

                <div className="flex flex-col gap-4 justify-center items-center m-2 ">
                  <div
                    className="py-3 px-2 w-full flex flex-row justify-center items-center gap-4 border-violet-400 border-1 rounded-xl hover:scale-105 transition-all cursor-pointer opacity-90 dark:opacity-100"
                    style={{
                      backgroundImage: `url(${discordBg})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "repeat-x",
                      zoom: ".9",
                    }}
                    onClick={() => window.open(DISCORD_INVITE_URL, "_blank", "noreferrer")}
                  >
                    <FaDiscord className="text-white h-[2.5rem]! w-[2.5rem]!" fill="currentColor" />
                    <div className="flex flex-col gap-1 justify-center items-start">
                      <span className="text-white text-lg font-semibold">Cozy Lounge</span>
                      <span className="text-slate-200 text-sm mt-[-3px]">Наше Дискорд сообщество</span>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="m-4 flex flex-row gap-2">
            <Button
              variant="destructive"
              className="flex-1 cursor-pointer"
              onClick={() => window.yandexMusicMod.forceQuit()}
            >
              <Power className="h-4 w-4" />
              Закрыть принудительно
            </Button>
            <Button variant="outline" className="text-foreground flex-1" onClick={() => setIsSheetOpen(false)}>
              Назад
            </Button>
          </div>
          </ErrorBoundary>
        </SheetContent>
      </Sheet>
    </ThemeProvider>
  );
}
