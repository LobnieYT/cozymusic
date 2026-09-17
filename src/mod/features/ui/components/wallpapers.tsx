import { useEffect, useRef, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Button } from "@ui/components/ui/button";
import { Slider } from "@ui/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";

import { ImagePlus, Trash2, Monitor } from "lucide-react";
import { toast } from "sonner";

import { WALLPAPER_KEYS, type WallpaperItem } from "~/mod/features/wallpapers/wallpapers";

const MAX_WALLPAPERS = 8;
const MAX_SIDE = 1920;

function uid() {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

async function fileToWallpaper(file: File): Promise<WallpaperItem> {
  const originalUrl = URL.createObjectURL(file);
  try {
    // Мелкие файлы кладём как есть, крупные ужимаем, чтобы не раздувать настройки
    if (file.size <= 300 * 1024) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });
      return { id: uid(), name: file.name, dataUrl };
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = originalUrl;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { id: uid(), name: file.name, dataUrl: canvas.toDataURL("image/jpeg", 0.85) };
  } finally {
    URL.revokeObjectURL(originalUrl);
  }
}

export function Wallpapers() {
  const [enabled, setEnabled] = useState(false);
  const [list, setList] = useState<WallpaperItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fit, setFit] = useState("cover");
  const [dim, setDim] = useState(0.5);
  const [slideshow, setSlideshow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const get = (k: string) => (window as any).yandexMusicMod.getStorageValue(k);
      setEnabled((await get(WALLPAPER_KEYS.enabled)) === true);
      setList((await get(WALLPAPER_KEYS.list)) || []);
      setActiveId((await get(WALLPAPER_KEYS.activeId)) || null);
      setFit((await get(WALLPAPER_KEYS.fit)) || "cover");
      setDim(typeof (await get(WALLPAPER_KEYS.dim)) === "number" ? await get(WALLPAPER_KEYS.dim) : 0.5);
      setSlideshow((await get(WALLPAPER_KEYS.slideshow)) || 0);
    })();
  }, []);

  const saveList = async (next: WallpaperItem[]) => {
    setList(next);
    await (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.list, next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_WALLPAPERS - list.length;
    if (room <= 0) {
      toast.error(`Максимум ${MAX_WALLPAPERS} обоев — удали лишние`);
      return;
    }
    try {
      const items: WallpaperItem[] = [];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        items.push(await fileToWallpaper(file));
      }
      if (items.length === 0) return;
      const next = [...list, ...items];
      await saveList(next);
      if (!activeId && next[0]) {
        setActiveId(next[0].id);
        await (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.activeId, next[0].id);
      }
      toast.success(`Добавлено обоев: ${items.length}`);
    } catch (e) {
      console.error("[wallpapers] upload failed:", e);
      toast.error("Не удалось загрузить картинку");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeItem = async (id: string) => {
    const next = list.filter((w) => w.id !== id);
    await saveList(next);
    if (activeId === id) {
      const fallback = next[0]?.id || null;
      setActiveId(fallback);
      await (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.activeId, fallback);
    }
  };

  const selectItem = async (id: string) => {
    setActiveId(id);
    await (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.activeId, id);
  };

  return (
    <ExpandableCard title="Кастомные обои" icon={<ImagePlus className="h-4 w-4" />}>
      <div className="flex flex-col gap-4 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="wallpapers-enabled-toggle"
            checked={enabled}
            onCheckedChange={async (value) => {
              if (value) {
                try {
                  const ids: string[] =
                    (await (window as any).yandexMusicMod.getStorageValue("plugins/enabled")) || [];
                  if (ids.includes("custom-background")) {
                    toast.error('Выключите плагин "CustomBackground"');
                    return;
                  }
                } catch {}
              }
              setEnabled(value);
              (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.enabled, value);
            }}
          />
          <Label htmlFor="wallpapers-enabled-toggle" className="cursor-pointer">
            Обои на фоне Яндекс Музыки
          </Label>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
          Загрузить обои ({list.length}/{MAX_WALLPAPERS})
        </Button>

        {list.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {list.map((w) => (
              <div
                key={w.id}
                onClick={() => selectItem(w.id)}
                title={w.name}
                className={
                  "group relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all " +
                  (w.id === activeId
                    ? "border-violet-400 shadow-[0_0_12px_-2px_rgba(167,139,250,0.8)]"
                    : "border-transparent opacity-70 hover:opacity-100")
                }
              >
                <img src={w.dataUrl} alt={w.name} className="h-full w-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(w.id);
                  }}
                  title="Удалить"
                  className="absolute top-1 right-1 hidden rounded-md bg-black/70 p-1 text-red-300 group-hover:block hover:bg-black"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Заполнение экрана</Label>
          <Select
            value={fit}
            onValueChange={(value) => {
              setFit(value);
              (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.fit, value);
            }}
          >
            <SelectTrigger className="text-foreground w-full">
              <SelectValue placeholder="Заполнение" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Заполнить (cover)</SelectItem>
              <SelectItem value="contain">Вписать целиком (contain)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>
            Затемнение для читаемости: {Math.round(dim * 100)}%
          </Label>
          <Slider
            value={[dim]}
            min={0}
            max={0.85}
            step={0.05}
            onValueChange={(value) => {
              setDim(value[0]!);
              (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.dim, value[0]);
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Автосмена обоев</Label>
          <Select
            value={String(slideshow)}
            onValueChange={(value) => {
              const next = parseInt(value, 10);
              setSlideshow(next);
              (window as any).yandexMusicMod.setStorageValue(WALLPAPER_KEYS.slideshow, next);
            }}
          >
            <SelectTrigger className="text-foreground w-full">
              <SelectValue placeholder="Автосмена" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Выключена</SelectItem>
              <SelectItem value="60">Каждую минуту</SelectItem>
              <SelectItem value="300">Каждые 5 минут</SelectItem>
              <SelectItem value="900">Каждые 15 минут</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ExpandableCard>
  );
}

export function WindowOpacity() {
  const [opacity, setOpacity] = useState(1);

  const apply = async (value: number) => {
    setOpacity(value);
    try {
      await (window as any).yandexMusicMod.setWindowOpacity(value);
    } catch (e) {
      console.error("[opacity] failed:", e);
    }
  };

  return (
    <ExpandableCard title="Прозрачность окна" icon={<Monitor className="h-4 w-4" />}>
      <div className="flex flex-col gap-2 pt-2 px-3">
        <Label>
          Непрозрачность: {Math.round(opacity * 100)}%
        </Label>
        <Slider value={[opacity]} min={0.3} max={1} step={0.05} onValueChange={(value) => apply(value[0]!)} />
        <span className="text-muted-foreground text-xs">
          Работает через композитор (X11). На Wayland может игнорироваться системой.
        </span>
      </div>
    </ExpandableCard>
  );
}
