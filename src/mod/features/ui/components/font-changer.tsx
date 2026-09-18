import { useEffect, useRef, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Button } from "@ui/components/ui/button";
import { If } from "@ui/components/ui/if";

import { Type, Upload, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

import "@ui/assets/fonts/stylesheet.css";
import availableFontsRaw from "@ui/assets/fonts/fonts.json";
const availableFonts = availableFontsRaw.map((font) => font.name);

interface UserFont {
  file: string;
  name: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.round(bytes / 1024)} КБ`;
}

export function FontChanger() {
  const [customFontEnabled, setCustomFontEnabled] = useState(false);
  const [customFont, setCustomFont] = useState(availableFonts[0]);
  const [userFonts, setUserFonts] = useState<UserFont[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshUserFonts = async () => {
    try {
      const res = await (window as any).yandexMusicMod.listUserFonts();
      if (res?.success) setUserFonts(res.fonts || []);
    } catch {}
  };

  useEffect(() => {
    (async () => {
      let savedFont = await window.yandexMusicMod.getStorageValue("font-changer/savedFont");
      const savedFontEnabled = (await window.yandexMusicMod.getStorageValue("font-changer/enabled")) || false;

      setCustomFontEnabled(savedFontEnabled || false);
      await refreshUserFonts();
      try {
        const res = await (window as any).yandexMusicMod.listUserFonts();
        const names = [...availableFonts, ...((res?.success ? res.fonts : []) || []).map((f: UserFont) => f.name)];
        savedFont = names.find((font) => font === savedFont) || availableFonts[0];
      } catch {
        savedFont = availableFonts.find((font) => font === savedFont) || availableFonts[0];
      }
      setCustomFont(savedFont || availableFonts[0]);
    })();
  }, []);

  const pickFont = (value: string) => {
    setCustomFont(value);
    window.yandexMusicMod.setStorageValue("font-changer/savedFont", value);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const okExt = [".ttf", ".otf", ".woff", ".woff2"];
    let added = 0;
    for (const file of Array.from(files)) {
      const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
      if (!okExt.includes(ext)) {
        toast.error(`Не шрифт: ${file.name} (нужны ttf/otf/woff/woff2)`);
        continue;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`Слишком большой: ${file.name} (макс 25 МБ)`);
        continue;
      }
      try {
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result || "");
            resolve(result.includes(",") ? result.split(",").pop()! : result);
          };
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        const res = await (window as any).yandexMusicMod.saveUserFont({ name: file.name, dataBase64 });
        if (res?.success) added++;
        else toast.error(`Не сохранён: ${file.name}`);
      } catch (e) {
        console.error("[font-changer] upload failed:", e);
        toast.error(`Не загружен: ${file.name}`);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
    if (added > 0) {
      toast.success(`Добавлено шрифтов: ${added}`);
      await refreshUserFonts();
    }
  };

  const removeFont = async (font: UserFont) => {
    try {
      await (window as any).yandexMusicMod.deleteUserFont(font.file);
      if (customFont === font.name) pickFont(availableFonts[0]!);
      await refreshUserFonts();
    } catch {}
  };

  return (
    <ExpandableCard title="Замена шрифтов" icon={<Type className="h-4 w-4" />}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="font-changer-toggle"
            checked={customFontEnabled}
            onCheckedChange={(enabled) => {
              setCustomFontEnabled(enabled);
              window.yandexMusicMod.setStorageValue("font-changer/enabled", enabled);
            }}
          />
          <Label htmlFor="font-changer-toggle" className="cursor-pointer">
            Заменить шрифты в приложении
          </Label>
        </div>

        <If condition={customFontEnabled}>
          <div className="flex gap-4 items-center justify-center">
            <span className="text-sm text-foreground">Шрифт:</span>
            <Select
              value={customFont}
              onValueChange={(value: string) => pickFont(value)}
              disabled={!customFontEnabled}
            >
              <SelectTrigger className="w-full text-foreground">
                <SelectValue placeholder="Выбрать шрифт" />
              </SelectTrigger>
              <SelectContent>
                {availableFonts.map((font) => (
                  <SelectItem value={font}>{font}</SelectItem>
                ))}
                {userFonts.map((font) => (
                  <SelectItem key={font.file} value={font.name}>
                    {font.name} (свой)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              Добавить свои шрифты
            </Button>
            {userFonts.map((font) => (
              <div
                key={font.file}
                className={
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm " +
                  (customFont === font.name ? "border-violet-400/60 bg-violet-500/10" : "border-transparent")
                }
              >
                <button
                  className="flex flex-1 cursor-pointer items-center gap-2 truncate text-left"
                  title="Выбрать"
                  onClick={() => pickFont(font.name)}
                >
                  {customFont === font.name && <Check className="h-4 w-4 shrink-0 text-violet-300" />}
                  <span className="truncate">{font.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{formatSize(font.size)}</span>
                </button>
                <button
                  className="shrink-0 cursor-pointer rounded-md p-1 text-red-300 hover:bg-white/10"
                  title="Удалить"
                  onClick={() => removeFont(font)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </If>
      </div>
    </ExpandableCard>
  );
}
